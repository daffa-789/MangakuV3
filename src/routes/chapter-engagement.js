import express from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { resolveRequestUser, hasMinimumRole } from '../utils/access.js';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  parsePositiveInteger,
} from '../utils/response.js';
import { cache } from '../utils/cache.js';

const router = express.Router();

const REACTION_TYPES = ['happy', 'sad', 'angry', 'love', 'laugh', 'wow'];

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

const reactionSchema = z.object({
  reaction: z.enum(REACTION_TYPES),
});

const commentSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

router.use(async (req, res, next) => {
  try {
    const { user, error } = await resolveRequestUser(pool, req);
    if (error) return errorResponse(res, error.message, error.status);
    req.user = user;
    return next();
  } catch (error) {
    return serverErrorResponse(res, error);
  }
});

async function getChapterById(connection, chapterId) {
  const [rows] = await connection.query(
    `SELECT id, book_id AS bookId, chapter_number AS chapterNumber
     FROM chapters
     WHERE id = ?
     LIMIT 1`,
    [chapterId],
  );
  return rows[0] || null;
}

function emptyReactionCounts() {
  return REACTION_TYPES.reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {});
}

async function fetchEngagementSummary(connection, chapterId, userId, userRole) {
  const [[ratingStats]] = await connection.query(
    `SELECT ROUND(AVG(rating), 1) AS averageRating,
            COUNT(*) AS ratingCount
     FROM chapter_ratings
     WHERE chapter_id = ?`,
    [chapterId],
  );

  const [userRatingRows] = await connection.query(
    `SELECT rating
     FROM chapter_ratings
     WHERE chapter_id = ? AND user_id = ?
     LIMIT 1`,
    [chapterId, userId],
  );

  const [reactionRows] = await connection.query(
    `SELECT reaction_type AS reactionType, COUNT(*) AS total
     FROM chapter_reactions
     WHERE chapter_id = ?
     GROUP BY reaction_type`,
    [chapterId],
  );

  const reactions = emptyReactionCounts();
  reactionRows.forEach((row) => {
    reactions[row.reactionType] = Number(row.total || 0);
  });

  const [userReactionRows] = await connection.query(
    `SELECT reaction_type AS reactionType
     FROM chapter_reactions
     WHERE chapter_id = ? AND user_id = ?
     LIMIT 1`,
    [chapterId, userId],
  );

  const [commentRows] = await connection.query(
    `SELECT cc.id,
            cc.body,
            cc.created_at AS createdAt,
            cc.user_id AS userId,
            u.email AS userEmail
     FROM chapter_comments cc
     JOIN users u ON u.id = cc.user_id
     WHERE cc.chapter_id = ?
     ORDER BY cc.created_at DESC, cc.id DESC`,
    [chapterId],
  );

  const isAdmin = hasMinimumRole({ role: userRole }, 'admin');
  const averageRating = ratingStats?.averageRating;
  const ratingCount = Number(ratingStats?.ratingCount || 0);

  return {
    averageRating:
      averageRating === null || averageRating === undefined
        ? 0
        : Number(averageRating),
    ratingCount,
    userRating: userRatingRows[0]?.rating
      ? Number(userRatingRows[0].rating)
      : null,
    reactions,
    userReaction: userReactionRows[0]?.reactionType || null,
    comments: commentRows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt,
      userId: row.userId,
      userEmail: row.userEmail,
      canDelete: row.userId === userId || isAdmin,
    })),
  };
}

function invalidateBooksCache() {
  cache.invalidatePattern('books:.*');
}

router.get('/:chapterId/engagement', async (req, res) => {
  const chapterId = parsePositiveInteger(req.params.chapterId);

  if (!chapterId) {
    return errorResponse(res, 'ID chapter tidak valid.');
  }

  try {
    const chapter = await getChapterById(pool, chapterId);

    if (!chapter) {
      return notFoundResponse(res, 'Chapter tidak ditemukan.');
    }

    const summary = await fetchEngagementSummary(
      pool,
      chapterId,
      req.user.id,
      req.user.role,
    );

    return successResponse(res, 'Data engagement chapter berhasil dimuat.', {
      chapterId,
      bookId: chapter.bookId,
      chapterNumber: chapter.chapterNumber,
      ...summary,
    });
  } catch (error) {
    console.error('Chapter engagement fetch error:', error.message);
    return serverErrorResponse(res, error);
  }
});

router.put('/:chapterId/rating', async (req, res) => {
  const chapterId = parsePositiveInteger(req.params.chapterId);

  if (!chapterId) {
    return errorResponse(res, 'ID chapter tidak valid.');
  }

  const parsed = ratingSchema.safeParse({
    rating: Number(req.body?.rating),
  });

  if (!parsed.success) {
    return errorResponse(res, 'Rating harus berupa angka 1 sampai 5.');
  }

  try {
    const chapter = await getChapterById(pool, chapterId);

    if (!chapter) {
      return notFoundResponse(res, 'Chapter tidak ditemukan.');
    }

    await pool.query(
      `INSERT INTO chapter_ratings (user_id, chapter_id, rating)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, chapterId, parsed.data.rating],
    );

    invalidateBooksCache();

    const summary = await fetchEngagementSummary(
      pool,
      chapterId,
      req.user.id,
      req.user.role,
    );

    return successResponse(res, 'Rating chapter berhasil disimpan.', {
      chapterId,
      ...summary,
    });
  } catch (error) {
    console.error('Chapter rating error:', error.message);
    return serverErrorResponse(res, error);
  }
});

router.put('/:chapterId/reaction', async (req, res) => {
  const chapterId = parsePositiveInteger(req.params.chapterId);

  if (!chapterId) {
    return errorResponse(res, 'ID chapter tidak valid.');
  }

  const parsed = reactionSchema.safeParse({
    reaction: String(req.body?.reaction || '').trim().toLowerCase(),
  });

  if (!parsed.success) {
    return errorResponse(res, 'Jenis reaksi tidak valid.');
  }

  try {
    const chapter = await getChapterById(pool, chapterId);

    if (!chapter) {
      return notFoundResponse(res, 'Chapter tidak ditemukan.');
    }

    const [existingRows] = await pool.query(
      `SELECT id, reaction_type AS reactionType
       FROM chapter_reactions
       WHERE user_id = ? AND chapter_id = ?
       LIMIT 1`,
      [req.user.id, chapterId],
    );

    const existing = existingRows[0];

    if (existing && existing.reactionType === parsed.data.reaction) {
      await pool.query('DELETE FROM chapter_reactions WHERE id = ?', [
        existing.id,
      ]);
    } else if (existing) {
      await pool.query(
        `UPDATE chapter_reactions
         SET reaction_type = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [parsed.data.reaction, existing.id],
      );
    } else {
      await pool.query(
        `INSERT INTO chapter_reactions (user_id, chapter_id, reaction_type)
         VALUES (?, ?, ?)`,
        [req.user.id, chapterId, parsed.data.reaction],
      );
    }

    const summary = await fetchEngagementSummary(
      pool,
      chapterId,
      req.user.id,
      req.user.role,
    );

    return successResponse(res, 'Reaksi chapter berhasil disimpan.', {
      chapterId,
      ...summary,
    });
  } catch (error) {
    console.error('Chapter reaction error:', error.message);
    return serverErrorResponse(res, error);
  }
});

router.post('/:chapterId/comments', async (req, res) => {
  const chapterId = parsePositiveInteger(req.params.chapterId);

  if (!chapterId) {
    return errorResponse(res, 'ID chapter tidak valid.');
  }

  const parsed = commentSchema.safeParse({
    body: req.body?.body,
  });

  if (!parsed.success) {
    return errorResponse(res, 'Komentar harus berisi 1 sampai 1000 karakter.');
  }

  try {
    const chapter = await getChapterById(pool, chapterId);

    if (!chapter) {
      return notFoundResponse(res, 'Chapter tidak ditemukan.');
    }

    const [result] = await pool.query(
      `INSERT INTO chapter_comments (user_id, chapter_id, body)
       VALUES (?, ?, ?)`,
      [req.user.id, chapterId, parsed.data.body],
    );

    const summary = await fetchEngagementSummary(
      pool,
      chapterId,
      req.user.id,
      req.user.role,
    );

    return successResponse(
      res,
      'Komentar berhasil ditambahkan.',
      {
        chapterId,
        commentId: result.insertId,
        ...summary,
      },
      201,
    );
  } catch (error) {
    console.error('Chapter comment create error:', error.message);
    return serverErrorResponse(res, error);
  }
});

router.delete('/:chapterId/comments/:commentId', async (req, res) => {
  const chapterId = parsePositiveInteger(req.params.chapterId);
  const commentId = parsePositiveInteger(req.params.commentId);

  if (!chapterId || !commentId) {
    return errorResponse(res, 'ID chapter atau komentar tidak valid.');
  }

  try {
    const chapter = await getChapterById(pool, chapterId);

    if (!chapter) {
      return notFoundResponse(res, 'Chapter tidak ditemukan.');
    }

    const [commentRows] = await pool.query(
      `SELECT id, user_id AS userId
       FROM chapter_comments
       WHERE id = ? AND chapter_id = ?
       LIMIT 1`,
      [commentId, chapterId],
    );

    const comment = commentRows[0];

    if (!comment) {
      return notFoundResponse(res, 'Komentar tidak ditemukan.');
    }

    const canDelete =
      comment.userId === req.user.id ||
      hasMinimumRole(req.user, 'admin');

    if (!canDelete) {
      return errorResponse(res, 'Kamu tidak bisa menghapus komentar ini.', 403);
    }

    await pool.query('DELETE FROM chapter_comments WHERE id = ?', [commentId]);

    const summary = await fetchEngagementSummary(
      pool,
      chapterId,
      req.user.id,
      req.user.role,
    );

    return successResponse(res, 'Komentar berhasil dihapus.', {
      chapterId,
      commentId,
      ...summary,
    });
  } catch (error) {
    console.error('Chapter comment delete error:', error.message);
    return serverErrorResponse(res, error);
  }
});

export default router;
