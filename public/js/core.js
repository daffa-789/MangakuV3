(() => {
  function normalizeEmail(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function getSession(sessionKey) {
    const rawSession = localStorage.getItem(sessionKey);

    if (!rawSession) {
      return null;
    }

    try {
      const parsedSession = JSON.parse(rawSession);

      if (!parsedSession.id || !parsedSession.email) {
        return null;
      }

      parsedSession.role = parsedSession.role || "user";
      return parsedSession;
    } catch (error) {
      return null;
    }
  }

  function setSession(sessionKey, userData) {
    if (!userData || !userData.id || !userData.email) {
      return;
    }

    localStorage.setItem(
      sessionKey,
      JSON.stringify({
        ...userData,
        role: userData.role || "user",
      }),
    );
  }

  function clearSession(sessionKey, additionalKeys = []) {
    localStorage.removeItem(sessionKey);

    additionalKeys.forEach((key) => {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {}
    });
  }

  function parsePositiveInteger(value) {
    const parsed = Number.parseInt(String(value || ""), 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }

  function normalizePositiveInteger(value) {
    if (value === undefined || value === null || value === "") {
      return Number.NaN;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      return Number.NaN;
    }

    return parsed;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderImageWithFallback(src, alt, fallbackLabel, options = {}) {
    const { fallbackClass = "cover-placeholder" } = options;
    const safeAlt = escapeHtml(alt);
    const safeFallbackLabel = escapeHtml(fallbackLabel);

    if (!src) {
      return `<div class="${fallbackClass}">${safeFallbackLabel}</div>`;
    }

    const safeSrc = escapeHtml(src);

    return `
      <img
        src="${safeSrc}"
        alt="${safeAlt}"
        onerror="this.hidden=true;this.nextElementSibling.hidden=false;" />
      <div class="${fallbackClass}" hidden>${safeFallbackLabel}</div>
    `;
  }

  function formatDate(value, options = {}) {
    const { emptyLabel = "Belum diatur", locale = "id-ID" } = options;

    if (!value) {
      return emptyLabel;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function formatDateTime(value, options = {}) {
    const { emptyLabel = "Belum ada", locale = "id-ID" } = options;

    if (!value) {
      return emptyLabel;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  async function parseJsonResponse(response) {
    try {
      return await response.json();
    } catch (error) {
      return {};
    }
  }

  function buildAuthHeaders(currentUser, baseHeaders = {}) {
    const userId = currentUser?.id;

    if (!userId) {
      return { ...baseHeaders };
    }

    const headers = {
      ...baseHeaders,
      "x-user-id": String(userId),
    };

    if (currentUser?.token) {
      headers.Authorization = `Bearer ${currentUser.token}`;
    }

    return headers;
  }

  function showFeedback(message, variant = "info") {
    if (!message) {
      return null;
    }

    const options = {
      icon:
        variant === "error"
          ? "error"
          : variant === "success"
            ? "success"
            : "info",
      title:
        variant === "error"
          ? "Gagal"
          : variant === "success"
            ? "Berhasil"
            : "Pemberitahuan",
      text: message,
      confirmButtonText: "OK",
    };

    if (window.MangakuAlerts?.showFeedback) {
      return window.MangakuAlerts.showFeedback(options);
    }

    if (window.Swal) {
      return Swal.fire(options);
    }

    window.alert(message);
    return null;
  }

  const GENRE_OPTIONS = [
    { value: "action", label: "Action" },
    { value: "adventure", label: "Adventure" },
    { value: "comedy", label: "Comedy" },
    { value: "demons", label: "Demons" },
    { value: "drama", label: "Drama" },
    { value: "fantasy", label: "Fantasy" },
    { value: "game", label: "Game" },
    { value: "gore", label: "Gore" },
    { value: "harem", label: "Harem" },
    { value: "historical", label: "Historical" },
    { value: "horror", label: "Horror" },
    { value: "isekai", label: "Isekai" },
    { value: "josei", label: "Josei" },
    { value: "magic", label: "Magic" },
    { value: "martial_arts", label: "Martial Arts" },
    { value: "mature", label: "Mature" },
    { value: "mecha", label: "Mecha" },
    { value: "military", label: "Military" },
    { value: "music", label: "Music" },
    { value: "mystery", label: "Mystery" },
    { value: "parody", label: "Parody" },
    { value: "psychological", label: "Psychological" },
    { value: "romance", label: "Romance" },
    { value: "school", label: "School" },
    { value: "sci_fi", label: "Sci-Fi" },
    { value: "seinen", label: "Seinen" },
    { value: "shoujo", label: "Shoujo" },
    { value: "shounen", label: "Shounen" },
    { value: "slice_of_life", label: "Slice of Life" },
    { value: "sports", label: "Sports" },
    { value: "supernatural", label: "Supernatural" },
    { value: "thriller", label: "Thriller" },
    { value: "vampire", label: "Vampire" },
  ];

  const STATUS_LABELS = {
    to_read: "Segera",
    reading: "Berjalan",
    completed: "Selesai",
  };

  function getGenreText(book) {
    return Array.isArray(book?.genres) && book.genres.length > 0
      ? book.genres
          .map(
            (genre) =>
              GENRE_OPTIONS.find((option) => option.value === genre)?.label ||
              genre,
          )
          .join(", ")
      : "General";
  }

  function getStatusLabel(status) {
    return STATUS_LABELS[String(status || "reading")] || "Berjalan";
  }

  function getReaderUrl(book, chapterNumber) {
    if (!book?.slug || !chapterNumber) {
      return null;
    }
    return `/read/manga/${encodeURIComponent(book.slug)}/${chapterNumber}/`;
  }

  window.MangakuCore = {
    normalizeEmail,
    getSession,
    setSession,
    clearSession,
    parsePositiveInteger,
    normalizePositiveInteger,
    escapeHtml,
    renderImageWithFallback,
    formatDate,
    formatDateTime,
    parseJsonResponse,
    buildAuthHeaders,
    showFeedback,
    GENRE_OPTIONS,
    STATUS_LABELS,
    getGenreText,
    getStatusLabel,
    getReaderUrl,
  };
})();
