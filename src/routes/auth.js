import express from "express";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { z } from "zod";
import { pool } from "../config/db.js";
import {
  normalizeEmail,
  normalizeRole,
  hasMinimumRole,
  isValidRole,
  getUserById,
  resolveRequestUser,
  buildAuthUserPayload,
} from "../utils/access.js";
import { logActivity } from "../utils/activity.js";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  parsePositiveInteger,
  validateId,
} from "../utils/response.js";
import { withTransaction } from "../utils/database.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const avatarUploadDir = path.join(__dirname, "..", "..", "public", "uploads", "avatars");

if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    cb(null, `user-${req.user.id}-${Date.now()}${extension}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);

    if (!allowed.has(file.mimetype)) {
      cb(new Error("Format avatar harus JPG, PNG, WEBP, atau GIF."));
      return;
    }

    cb(null, true);
  },
});

const MIN_PASSWORD_LENGTH = 6;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;

// Error code konstan — hindari typo string literal (AUDIT 7.10).
const ERROR_CODES = {
  EMAIL_EXISTS: "EMAIL_EXISTS",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  LAST_SUPER_ADMIN: "LAST_SUPER_ADMIN",
};
const BOOTSTRAP_SUPER_ADMIN_EMAILS = new Set(
  String(
    process.env.BOOTSTRAP_SUPER_ADMIN_EMAILS ||
      process.env.BOOTSTRAP_ADMIN_EMAILS ||
      "admin@mangaku.local",
  )
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const credentialsSchema = z.object({
  email: z
    .string({ required_error: "Email wajib diisi." })
    .trim()
    .min(1, "Email wajib diisi.")
    .email("Format email tidak valid.")
    .transform((value) => value.toLowerCase()),
  password: z
    .string({ required_error: "Password wajib diisi." })
    .min(1, "Password wajib diisi.")
    .min(
      MIN_PASSWORD_LENGTH,
      `Password minimal ${MIN_PASSWORD_LENGTH} karakter.`,
    ),
});

const registerSchema = credentialsSchema.extend({
  username: z
    .string({ required_error: "Username wajib diisi." })
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(50, "Username maksimal 50 karakter.")
    .regex(
      USERNAME_REGEX,
      "Username hanya boleh huruf, angka, dan underscore.",
    ),
});

const profileUpdateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(50, "Username maksimal 50 karakter.")
    .regex(
      USERNAME_REGEX,
      "Username hanya boleh huruf, angka, dan underscore.",
    )
    .optional(),
  displayName: z
    .string()
    .trim()
    .max(100, "Nama asli maksimal 100 karakter.")
    .optional()
    .nullable(),
  birthday: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format ulang tahun harus YYYY-MM-DD.")
    .optional()
    .nullable(),
  bio: z
    .string()
    .trim()
    .max(1000, "Bio maksimal 1000 karakter.")
    .optional()
    .nullable(),
});

function parseCredentials(body = {}) {
  const result = credentialsSchema.safeParse(body);
  if (!result.success) {
    return {
      data: null,
      error: result.error.issues[0]?.message || "Data login tidak valid.",
    };
  }
  return { data: result.data, error: null };
}

function parseRegisterPayload(body = {}) {
  const result = registerSchema.safeParse(body);
  if (!result.success) {
    return {
      data: null,
      error: result.error.issues[0]?.message || "Data registrasi tidak valid.",
    };
  }
  return { data: result.data, error: null };
}

function parseProfileUpdate(body = {}) {
  const result = profileUpdateSchema.safeParse(body);
  if (!result.success) {
    return {
      data: null,
      error: result.error.issues[0]?.message || "Data profil tidak valid.",
    };
  }
  return { data: result.data, error: null };
}

// Memvalidasi role mentah dari request tanpa coercion. normalizeRole() saja
// tidak cukup karena ia memaksa nilai invalid menjadi "user", sehingga input
// role ilegal (mis. "hacker") akan diam-diam diterima sebagai "user".
function parseRole(value) {
  return isValidRole(value) ? normalizeRole(value) : null;
}

async function requireMinimumRole(req, res, minimumRole) {
  try {
    const { user, error } = await resolveRequestUser(pool, req, {
      requireToken: true,
    });
    if (error) {
      return errorResponse(res, error.message, error.status);
    }
    if (!hasMinimumRole(user.role, minimumRole)) {
      return errorResponse(
        res,
        minimumRole === "super_admin"
          ? "Akses super admin diperlukan."
          : "Akses admin atau super admin diperlukan.",
        403,
      );
    }
    return user;
  } catch (error) {
    return serverErrorResponse(res, error);
  }
}

async function getRoleCounts() {
  const [rows] = await pool.query(
    "SELECT role, COUNT(*) AS total FROM users GROUP BY role",
  );
  return rows.reduce(
    (acc, row) => ({
      ...acc,
      [normalizeRole(row.role)]: Number(row.total || 0),
    }),
    { super_admin: 0, admin: 0, user: 0 },
  );
}

function mapActivityLogRow(row = {}) {
  return {
    id: row.id,
    userId: row.userId === null ? null : Number(row.userId),
    userEmail: row.userEmail || "User dihapus",
    userRole: row.userRole || "unknown",
    action: row.action || "",
    description: row.description || "",
    targetType: row.targetType || null,
    targetId: row.targetId === null ? null : Number(row.targetId),
    createdAt: row.createdAt || null,
  };
}

// GET /api/auth/me
router.get("/me", async (req, res) => {
  try {
    const { user, error } = await resolveRequestUser(pool, req);
    if (error) return errorResponse(res, error.message, error.status);
    return successResponse(
      res,
      "User berhasil dimuat.",
      buildAuthUserPayload(user),
    );
  } catch (error) {
    return serverErrorResponse(res, error);
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { data, error } = parseRegisterPayload(req.body);
  if (error) return errorResponse(res, error);

  const { email, password, username } = data;

  try {
    const result = await withTransaction(pool, async (connection) => {
      const [existingUsers] = await connection.query(
        "SELECT id FROM users WHERE email = ? LIMIT 1",
        [email],
      );
      if (existingUsers.length > 0) {
        throw new Error(ERROR_CODES.EMAIL_EXISTS);
      }

      const [existingUsernames] = await connection.query(
        "SELECT id FROM users WHERE username = ? LIMIT 1",
        [username],
      );
      if (existingUsernames.length > 0) {
        throw new Error("USERNAME_EXISTS");
      }

      const [superAdminCountRows] = await connection.query(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'super_admin'",
      );
      const shouldBootstrap =
        Number(superAdminCountRows[0]?.count || 0) === 0 &&
        BOOTSTRAP_SUPER_ADMIN_EMAILS.has(normalizeEmail(email));
      const role = shouldBootstrap ? "super_admin" : "user";

      const hashedPassword = await bcrypt.hash(password, 12);

      const [insertResult] = await connection.query(
        "INSERT INTO users (email, password, role, username) VALUES (?, ?, ?, ?)",
        [email, hashedPassword, role, username],
      );

      const userId = insertResult.insertId;
      const user = await getUserById(connection, userId);

      await logActivity(connection, userId, "register", `${email} mendaftar.`, {
        targetType: "user",
        targetId: userId,
      });

      return user;
    });

    return successResponse(
      res,
      "Registrasi berhasil.",
      buildAuthUserPayload(result),
      201,
    );
  } catch (error) {
    if (error.message === ERROR_CODES.EMAIL_EXISTS) {
      return errorResponse(res, "Email sudah terdaftar.", 409);
    }
    if (error.message === "USERNAME_EXISTS") {
      return errorResponse(res, "Username sudah dipakai.", 409);
    }
    return serverErrorResponse(res, error);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { data, error } = parseCredentials(req.body);
  if (error) return errorResponse(res, error);

  const { email, password } = data;

  try {
    const [rows] = await pool.query(
      "SELECT id, email, password, role FROM users WHERE email = ? LIMIT 1",
      [email],
    );
    const user = rows[0];

    if (!user) {
      return errorResponse(res, "Email atau password salah.", 401);
    }

    // Migration strategy: support both hashed and legacy plain-text passwords
    const isHashed = user.password.startsWith('$2');
    let passwordValid = false;

    if (isHashed) {
      passwordValid = await bcrypt.compare(password, user.password);
    } else {
      // Legacy plain-text comparison + auto-rehash
      passwordValid = (user.password === password);
      if (passwordValid) {
        // Upgrade to hashed password
        const hashed = await bcrypt.hash(password, 12);
        await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashed, user.id]);
      }
    }

    if (!passwordValid) {
      return errorResponse(res, "Email atau password salah.", 401);
    }

    await logActivity(pool, user.id, "login", `${email} login.`, {
      targetType: "user",
      targetId: user.id,
    });

    return successResponse(res, "Login berhasil.", buildAuthUserPayload(user));
  } catch (error) {
    return serverErrorResponse(res, error);
  }
});

// GET /api/auth/profile
router.get("/profile", async (req, res) => {
  try {
    const { user, error } = await resolveRequestUser(pool, req);
    if (error) return errorResponse(res, error.message, error.status);

    return successResponse(res, "Profil berhasil dimuat.", {
      id: user.id,
      email: user.email,
      role: user.role,
      username: user.username,
      displayName: user.displayName,
      birthday: user.birthday,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    });
  } catch (error) {
    return serverErrorResponse(res, error);
  }
});

// PATCH /api/auth/profile
router.patch("/profile", async (req, res) => {
  const { data, error } = parseProfileUpdate(req.body);
  if (error) return errorResponse(res, error);

  try {
    const { user, error: authError } = await resolveRequestUser(pool, req);
    if (authError) {
      return errorResponse(res, authError.message, authError.status);
    }

    if (data.username) {
      const [existingRows] = await pool.query(
        "SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1",
        [data.username, user.id],
      );

      if (existingRows.length > 0) {
        return errorResponse(res, "Username sudah dipakai.", 409);
      }
    }

    const updates = [];
    const values = [];

    if (data.username !== undefined) {
      updates.push("username = ?");
      values.push(data.username);
    }

    if (data.displayName !== undefined) {
      updates.push("display_name = ?");
      values.push(data.displayName || null);
    }

    if (data.birthday !== undefined) {
      updates.push("birthday = ?");
      values.push(data.birthday || null);
    }

    if (data.bio !== undefined) {
      updates.push("bio = ?");
      values.push(data.bio || null);
    }

    if (updates.length === 0) {
      return errorResponse(res, "Tidak ada data profil yang diperbarui.");
    }

    values.push(user.id);

    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );

    const updatedUser = await getUserById(pool, user.id);

    await logActivity(pool, user.id, "update_profile", `${user.email} memperbarui profil.`, {
      targetType: "user",
      targetId: user.id,
    });

    return successResponse(res, "Profil berhasil diperbarui.", {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      username: updatedUser.username,
      displayName: updatedUser.displayName,
      birthday: updatedUser.birthday,
      avatarUrl: updatedUser.avatarUrl,
      bio: updatedUser.bio,
    });
  } catch (error) {
    return serverErrorResponse(res, error);
  }
});

// POST /api/auth/profile/avatar
router.post("/profile/avatar", async (req, res) => {
  try {
    const { user, error } = await resolveRequestUser(pool, req);
    if (error) return errorResponse(res, error.message, error.status);

    avatarUpload.single("avatar")(req, res, async (uploadError) => {
      if (uploadError) {
        if (uploadError.code === "LIMIT_FILE_SIZE") {
          return errorResponse(res, "Ukuran avatar maksimal 5MB.");
        }

        return errorResponse(res, uploadError.message || "Upload avatar gagal.");
      }

      if (!req.file) {
        return errorResponse(res, "File avatar wajib dipilih.");
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      await pool.query("UPDATE users SET avatar_url = ? WHERE id = ?", [
        avatarUrl,
        user.id,
      ]);

      const updatedUser = await getUserById(pool, user.id);

      await logActivity(
        pool,
        user.id,
        "update_avatar",
        `${user.email} memperbarui foto profil.`,
        { targetType: "user", targetId: user.id },
      );

      return successResponse(res, "Foto profil berhasil diperbarui.", {
        avatarUrl: updatedUser.avatarUrl,
      });
    });
  } catch (error) {
    return serverErrorResponse(res, error);
  }
});

// GET /api/auth/users
router.get("/users", async (req, res) => {
  const managerUser = await requireMinimumRole(req, res, "admin");
  if (!managerUser) return;

  try {
    const [rows] = await pool.query(
      "SELECT id, email, role, created_at AS createdAt, updated_at AS updatedAt FROM users ORDER BY created_at DESC, id DESC",
    );
    const roleCounts = await getRoleCounts();

    return successResponse(res, "Daftar user berhasil dimuat.", {
      users: rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: normalizeRole(row.role),
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null,
      })),
      roleCounts,
    });
  } catch (error) {
    return serverErrorResponse(res, error);
  }
});

// PATCH /api/auth/users/:id/role
router.patch("/users/:id/role", async (req, res) => {
  const superAdminUser = await requireMinimumRole(req, res, "super_admin");
  if (!superAdminUser) return;

  const targetUserId = parsePositiveInteger(req.params.id);
  const validationError = validateId(targetUserId, "ID user");
  if (validationError) return errorResponse(res, validationError);

  const nextRole = parseRole(req.body?.role);
  if (!nextRole) return errorResponse(res, "Role tidak valid.");

  try {
    const targetUser = await getUserById(pool, targetUserId);
    if (!targetUser) return notFoundResponse(res, "User tidak ditemukan.");

    if (targetUserId === superAdminUser.id) {
      return errorResponse(
        res,
        "Tidak bisa mengubah role akun yang sedang dipakai.",
      );
    }

    if (
      normalizeRole(targetUser.role) === "super_admin" &&
      nextRole !== "super_admin"
    ) {
      const [countRows] = await pool.query(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'super_admin'",
      );
      if (Number(countRows[0]?.count || 0) <= 1) {
        return errorResponse(
          res,
          "Tidak bisa mengubah super admin terakhir ke role lain.",
        );
      }
    }

    await pool.query("UPDATE users SET role = ? WHERE id = ?", [
      nextRole,
      targetUserId,
    ]);
    await logActivity(
      pool,
      superAdminUser.id,
      "update_role",
      `${superAdminUser.email} mengubah role ${targetUser.email} menjadi ${nextRole}.`,
      { targetType: "user", targetId: targetUserId },
    );

    return successResponse(res, "Role berhasil diperbarui.", {
      id: targetUser.id,
      email: targetUser.email,
      role: nextRole,
    });
  } catch (error) {
    return serverErrorResponse(res, error);
  }
});

// DELETE /api/auth/users/:id
router.delete("/users/:id", async (req, res) => {
  const superAdminUser = await requireMinimumRole(req, res, "super_admin");
  if (!superAdminUser) return;

  const targetUserId = parsePositiveInteger(req.params.id);
  const validationError = validateId(targetUserId, "ID user");
  if (validationError) return errorResponse(res, validationError);

  if (targetUserId === superAdminUser.id) {
    return errorResponse(res, "Tidak bisa menghapus akun yang sedang dipakai.");
  }

  try {
    const result = await withTransaction(pool, async (connection) => {
      const [targetRows] = await connection.query(
        "SELECT id, email, role FROM users WHERE id = ? LIMIT 1",
        [targetUserId],
      );
      const targetUser = targetRows[0];
      if (!targetUser) throw new Error(ERROR_CODES.USER_NOT_FOUND);

      if (normalizeRole(targetUser.role) === "super_admin") {
        const [countRows] = await connection.query(
          "SELECT COUNT(*) AS count FROM users WHERE role = 'super_admin'",
        );
        if (Number(countRows[0]?.count || 0) <= 1) {
          throw new Error(ERROR_CODES.LAST_SUPER_ADMIN);
        }
      }

      await logActivity(
        connection,
        superAdminUser.id,
        "delete_user",
        `${superAdminUser.email} menghapus akun ${targetUser.email}.`,
        { targetType: "user", targetId: targetUserId },
      );

      await connection.query("DELETE FROM users WHERE id = ?", [targetUserId]);
      return targetUser;
    });

    return successResponse(res, "User berhasil dihapus.", {
      id: result.id,
      email: result.email,
      role: normalizeRole(result.role),
    });
  } catch (error) {
    if (error.message === ERROR_CODES.USER_NOT_FOUND) {
      return notFoundResponse(res, "User tidak ditemukan.");
    }
    if (error.message === ERROR_CODES.LAST_SUPER_ADMIN) {
      return errorResponse(res, "Tidak bisa menghapus super admin terakhir.");
    }
    return serverErrorResponse(res, error);
  }
});

// GET /api/auth/logs
router.get("/logs", async (req, res) => {
  const managerUser = await requireMinimumRole(req, res, "admin");
  if (!managerUser) return;

  try {
    const [rows] = await pool.query(
      `SELECT l.id,
              l.actor_user_id AS userId,
              u.email AS userEmail,
              u.role AS userRole,
              l.action,
              l.description,
              l.target_type AS targetType,
              l.target_id AS targetId,
              l.created_at AS createdAt
       FROM activity_logs l
       LEFT JOIN users u ON u.id = l.actor_user_id
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT 250`,
    );

    return successResponse(
      res,
      "Activity logs berhasil dimuat.",
      rows.map(mapActivityLogRow),
    );
  } catch (error) {
    return serverErrorResponse(res, error);
  }
});

// DELETE /api/auth/logs - Hapus semua activity logs (admin only)
router.delete("/logs", async (req, res) => {
  const managerUser = await requireMinimumRole(req, res, "admin");
  if (!managerUser) return;

  try {
    await pool.query("DELETE FROM activity_logs");
    return successResponse(res, "Semua activity logs berhasil dihapus.");
  } catch (error) {
    return serverErrorResponse(res, error);
  }
});

export default router;
