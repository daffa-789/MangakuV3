const READER_ENDPOINT = "/api/reader/manga";
const CHAPTER_ENGAGEMENT_ENDPOINT = "/api/chapters";
const MIN_SESSION_SECONDS = 5;

const REACTION_OPTIONS = [
  { type: "happy", emoji: "😊", label: "Happy" },
  { type: "sad", emoji: "😢", label: "Sad" },
  { type: "angry", emoji: "😠", label: "Angry" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "laugh", emoji: "😂", label: "Laugh" },
  { type: "wow", emoji: "😮", label: "Wow" },
];

const state = {
  currentUser: null,
  reader: null,
  session: null,
  engagement: null,
};

function cacheReaderDom() {
  state.dom = {
    readerScroll: document.getElementById("readerScroll"),
    readerContent: document.getElementById("readerContent"),
    rightChapterList: document.getElementById("readerRightChapterList"),
    rightChapterMeta: document.getElementById("readerRightChapterMeta"),
    rightSidebar: document.getElementById("readerRightSidebar"),
    rightSidebarClose: document.getElementById("readerRightClose"),
    rightToggle: document.getElementById("readerRightToggle"),
    headerToggle: document.getElementById("readerHeaderToggle"),
    headerRestore: document.getElementById("readerHeaderRestore"),
    sidebarOverlay: document.getElementById("readerSidebarOverlay"),
    prevButton: document.getElementById("readerPrevButton"),
    nextButton: document.getElementById("readerNextButton"),
    subtitle: document.getElementById("readerSubtitle"),
    pageCounter: document.getElementById("readerPageCounter"),
    chapterEngagement: document.getElementById("chapterEngagement"),
    chapterEngagementSubtitle: document.getElementById(
      "chapterEngagementSubtitle",
    ),
    chapterRatingStars: document.getElementById("chapterRatingStars"),
    chapterRatingSummary: document.getElementById("chapterRatingSummary"),
    chapterReactionBar: document.getElementById("chapterReactionBar"),
    chapterCommentForm: document.getElementById("chapterCommentForm"),
    chapterCommentInput: document.getElementById("chapterCommentInput"),
    chapterCommentList: document.getElementById("chapterCommentList"),
  };
}

function getCurrentUserSession() {
  return window.MangakuSession.getCurrentUserSession();
}

function clearCurrentUserSession() {
  window.MangakuSession.clearCurrentUserSession();
}

function redirectToLogin() {
  clearCurrentUserSession();
  window.location.replace("/login.html");
}

function escapeHtml(value) {
  return window.MangakuCore.escapeHtml(value);
}

function parseReaderPath(pathname) {
  const legacyMatch = String(pathname || "").match(
    /^\/read\/manga\/([^/]+)\/([^/]+)\/([^/]+)\/?$/i,
  );

  if (legacyMatch) {
    const slug = decodeURIComponent(legacyMatch[1]);
    const chapter = legacyMatch[2];
    window.location.replace(`/read/manga/${encodeURIComponent(slug)}/${chapter}`);
    return null;
  }

  const match = String(pathname || "").match(
    /^\/read\/manga\/([^/]+)\/([^/]+)\/?$/i,
  );

  if (!match) {
    return null;
  }

  return {
    slug: decodeURIComponent(match[1]),
    chapter: match[2],
  };
}

function parseReaderRoute() {
  return parseReaderPath(window.location.pathname);
}

function hydrateReaderIdentity() {
  const dashboardLink = document.getElementById("readerDashboardLink");

  if (dashboardLink) {
    const label = "Kembali ke Dashboard";
    dashboardLink.setAttribute("aria-label", label);
    dashboardLink.setAttribute("title", label);
  }
}

function syncReaderHeaderControls() {
  const isCollapsed = document.body.classList.contains(
    "reader-header-collapsed",
  );
  const headerRestore =
    state.dom?.headerRestore || document.getElementById("readerHeaderRestore");

  if (!headerRestore) {
    return;
  }

  if (isCollapsed) {
    headerRestore.removeAttribute("aria-hidden");
    headerRestore.removeAttribute("tabindex");
    return;
  }

  if (document.activeElement === headerRestore) {
    const headerToggle =
      state.dom?.headerToggle || document.getElementById("readerHeaderToggle");
    if (headerToggle) {
      headerToggle.focus();
    } else {
      headerRestore.blur();
    }
  }

  headerRestore.setAttribute("aria-hidden", "true");
  headerRestore.setAttribute("tabindex", "-1");
}

function updateReaderHeader(data) {
  const bookTitle = document.getElementById("readerBookTitle");

  if (bookTitle) {
    bookTitle.textContent = data.book.title;
  }
}

function buildReaderHref(chapterNumber) {
  const slug = state.reader?.book?.slug;

  if (!slug || !chapterNumber) {
    return "";
  }

  return `/read/manga/${encodeURIComponent(slug)}/${chapterNumber}/`;
}

function getAdjacentChapterHref(direction) {
  const chapters = state.reader?.chapters || [];
  const activeId = state.reader?.chapter?.id;

  if (!activeId || chapters.length === 0) {
    return "";
  }

  let index = chapters.findIndex((chapter) => chapter.id === activeId);

  if (index < 0) {
    return "";
  }

  const step = direction < 0 ? -1 : 1;

  for (index += step; index >= 0 && index < chapters.length; index += step) {
    const chapter = chapters[index];
    const pageCount = Number(chapter.pageCount || 0);

    if (pageCount > 0) {
      return buildReaderHref(Number(chapter.chapterNumber));
    }
  }

  return "";
}

function syncNavigationControls() {
  const previousHref = getAdjacentChapterHref(-1);
  const nextHref = getAdjacentChapterHref(1);

  const prevButton = state.dom?.prevButton;
  if (prevButton) {
    prevButton.dataset.href = previousHref;
    prevButton.disabled = !previousHref;
  }

  const nextButton = state.dom?.nextButton;
  if (nextButton) {
    nextButton.dataset.href = nextHref;
    nextButton.disabled = !nextHref;
  }
}

function updateReaderIndicators() {
  const chapterNumber = state.reader?.chapter?.chapterNumber || "?";
  const totalPages = state.reader?.pages?.length || 0;

  const subtitle =
    state.dom?.subtitle || document.getElementById("readerSubtitle");
  if (subtitle) {
    subtitle.textContent = `Chapter ${chapterNumber}`;
  }

  const pageCounter =
    state.dom?.pageCounter || document.getElementById("readerPageCounter");
  if (pageCounter) {
    pageCounter.textContent =
      totalPages > 0 ? `${totalPages} halaman` : "Tanpa halaman";
  }
}

function scrollReaderToTop() {
  const scrollContainer =
    state.dom?.readerScroll || document.getElementById("readerScroll");

  if (scrollContainer) {
    scrollContainer.scrollTop = 0;
    return;
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderReaderNotFound(message) {
  const rightChapterList =
    state.dom?.rightChapterList ||
    document.getElementById("readerRightChapterList");
  const rightChapterMeta =
    state.dom?.rightChapterMeta ||
    document.getElementById("readerRightChapterMeta");
  const content =
    state.dom?.readerContent || document.getElementById("readerContent");
  const emptyChapterMessage =
    '<p class="empty-state">Tidak ada daftar chapter untuk ditampilkan.</p>';

  if (rightChapterMeta) {
    rightChapterMeta.textContent = "0 chapter";
  }

  if (rightChapterList) {
    rightChapterList.innerHTML = emptyChapterMessage;
  }

  if (content) {
    content.innerHTML = `
      <div class="reader-empty">
        <h3>Halaman reader tidak ditemukan</h3>
        <p>${escapeHtml(message || "Coba cek lagi nomor chapter manga.")}</p>
        <div class="button-row">
          <a class="primary-button" href="/home.html">Kembali ke Dashboard</a>
        </div>
      </div>
    `;
  }

  const panel = document.getElementById("chapterEngagement");
  if (panel) {
    panel.hidden = true;
  }
}

function renderReader(data) {
  const rightChapterList =
    state.dom?.rightChapterList ||
    document.getElementById("readerRightChapterList");
  const rightChapterMeta =
    state.dom?.rightChapterMeta ||
    document.getElementById("readerRightChapterMeta");
  const content =
    state.dom?.readerContent || document.getElementById("readerContent");

  state.reader = data;

  updateReaderHeader(data);

  const chaptersHtml = data.chapters
    .map(
      (chapter) => `
        <a
          href="${chapter.href}"
          class="reader-chapter-item ${chapter.isCurrent ? "active is-active" : ""}"
          data-reader-link>
          <strong>Chapter ${chapter.chapterNumber}</strong>
        </a>
      `,
    )
    .join("");

  if (rightChapterMeta) {
    rightChapterMeta.textContent = `${data.chapters.length} chapter`;
  }

  if (rightChapterList) {
    rightChapterList.innerHTML = chaptersHtml;
  }

  if (content) {
    const pagesHtml = data.pages
      .map(
        (page) => `
          <div class="reader-page-item" data-page-number="${page.pageNumber}">
            <div class="reader-image-skeleton"></div>
            <img
              src="${page.imageUrl}"
              alt="Page ${page.pageNumber}"
              class="reader-image"
              loading="lazy"
              onload="this.previousElementSibling.style.display='none'" />
          </div>
        `,
      )
      .join("");

    content.innerHTML = pagesHtml;
  }

  syncNavigationControls();
  updateReaderIndicators();
  scrollReaderToTop();

  loadChapterEngagement(data.chapter?.id).catch((error) => {
    console.warn("Chapter engagement load warning:", error.message);
  });
}

function formatEngagementDate(value) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (error) {
    return String(value);
  }
}

function renderRatingStars(data) {
  const container =
    state.dom?.chapterRatingStars ||
    document.getElementById("chapterRatingStars");
  const summary =
    state.dom?.chapterRatingSummary ||
    document.getElementById("chapterRatingSummary");

  if (!container || !summary) {
    return;
  }

  const userRating = Number(data?.userRating || 0);
  const averageRating = Number(data?.averageRating || 0);
  const ratingCount = Number(data?.ratingCount || 0);

  container.innerHTML = Array.from({ length: 5 }, (_, index) => {
    const starValue = index + 1;
    const isActive = userRating >= starValue;

    return `
      <button
        type="button"
        class="chapter-rating-star ${isActive ? "is-active" : ""}"
        data-rating="${starValue}"
        aria-label="Beri rating ${starValue} bintang"
        title="Rating ${starValue}">
        <i class="bi bi-star${isActive ? "-fill" : ""}"></i>
      </button>
    `;
  }).join("");

  if (ratingCount > 0) {
    summary.textContent = `${averageRating.toFixed(1)} / 5 (${ratingCount} rating)`;
  } else {
    summary.textContent = "Belum ada rating";
  }
}

function renderReactionBar(data) {
  const container =
    state.dom?.chapterReactionBar ||
    document.getElementById("chapterReactionBar");

  if (!container) {
    return;
  }

  const reactions = data?.reactions || {};
  const userReaction = data?.userReaction || null;

  container.innerHTML = REACTION_OPTIONS.map((option) => {
    const count = Number(reactions[option.type] || 0);
    const isActive = userReaction === option.type;

    return `
      <button
        type="button"
        class="chapter-reaction-button ${isActive ? "is-active" : ""}"
        data-reaction="${option.type}"
        aria-label="${option.label}"
        title="${option.label}">
        <span class="chapter-reaction-emoji" aria-hidden="true">${option.emoji}</span>
        <span class="chapter-reaction-count">${count}</span>
      </button>
    `;
  }).join("");
}

function renderCommentList(comments = []) {
  const container =
    state.dom?.chapterCommentList ||
    document.getElementById("chapterCommentList");

  if (!container) {
    return;
  }

  if (!Array.isArray(comments) || comments.length === 0) {
    container.innerHTML =
      '<p class="chapter-comment-empty">Belum ada komentar untuk chapter ini.</p>';
    return;
  }

  container.innerHTML = comments
    .map(
      (comment) => `
        <article class="chapter-comment-item" data-comment-id="${comment.id}">
          <header class="chapter-comment-meta">
            <strong>${escapeHtml(comment.userEmail || "Pengguna")}</strong>
            <time datetime="${escapeHtml(comment.createdAt || "")}">${escapeHtml(formatEngagementDate(comment.createdAt))}</time>
          </header>
          <p class="chapter-comment-body">${escapeHtml(comment.body || "")}</p>
          ${
            comment.canDelete
              ? `<button
                  type="button"
                  class="secondary-button small chapter-comment-delete"
                  data-comment-id="${comment.id}">
                  Hapus
                </button>`
              : ""
          }
        </article>
      `,
    )
    .join("");
}

function renderChapterEngagement(data) {
  const panel =
    state.dom?.chapterEngagement ||
    document.getElementById("chapterEngagement");
  const subtitle =
    state.dom?.chapterEngagementSubtitle ||
    document.getElementById("chapterEngagementSubtitle");

  if (!panel) {
    return;
  }

  state.engagement = data;

  if (subtitle) {
    const chapterNumber = state.reader?.chapter?.chapterNumber || "?";
    subtitle.textContent = `Chapter ${chapterNumber}`;
  }

  renderRatingStars(data);
  renderReactionBar(data);
  renderCommentList(data?.comments || []);
  panel.hidden = false;
}

async function requestEngagement(method, path, body = null) {
  const normalizedMethod = String(method || "GET").toLowerCase();

  if (normalizedMethod === "get") {
    const result = await window.MangakuApi.get(path);
    return result.data;
  }

  if (normalizedMethod === "put") {
    const result = await window.MangakuApi.put(path, body);
    return result.data;
  }

  if (normalizedMethod === "post") {
    const result = await window.MangakuApi.post(path, body);
    return result.data;
  }

  if (normalizedMethod === "delete") {
    const result = await window.MangakuApi.delete(path);
    return result.data;
  }

  throw new Error(`Metode engagement tidak didukung: ${method}`);
}

async function loadChapterEngagement(chapterId) {
  if (!chapterId) {
    return;
  }

  const data = await requestEngagement(
    "GET",
    `${CHAPTER_ENGAGEMENT_ENDPOINT}/${chapterId}/engagement`,
  );

  renderChapterEngagement(data);
}

async function submitChapterRating(rating) {
  const chapterId = state.reader?.chapter?.id;

  if (!chapterId) {
    return;
  }

  const data = await requestEngagement(
    "PUT",
    `${CHAPTER_ENGAGEMENT_ENDPOINT}/${chapterId}/rating`,
    { rating },
  );

  renderChapterEngagement(data);
}

async function submitChapterReaction(reaction) {
  const chapterId = state.reader?.chapter?.id;

  if (!chapterId) {
    return;
  }

  const data = await requestEngagement(
    "PUT",
    `${CHAPTER_ENGAGEMENT_ENDPOINT}/${chapterId}/reaction`,
    { reaction },
  );

  renderChapterEngagement(data);
}

async function submitChapterComment(body) {
  const chapterId = state.reader?.chapter?.id;

  if (!chapterId) {
    return;
  }

  const data = await requestEngagement(
    "POST",
    `${CHAPTER_ENGAGEMENT_ENDPOINT}/${chapterId}/comments`,
    { body },
  );

  renderChapterEngagement(data);
}

async function deleteChapterComment(commentId) {
  const chapterId = state.reader?.chapter?.id;

  if (!chapterId || !commentId) {
    return;
  }

  const data = await requestEngagement(
    "DELETE",
    `${CHAPTER_ENGAGEMENT_ENDPOINT}/${chapterId}/comments/${commentId}`,
  );

  renderChapterEngagement(data);
}

function attachEngagementInteractions() {
  const panel =
    state.dom?.chapterEngagement ||
    document.getElementById("chapterEngagement");

  if (!panel || panel.dataset.bound === "true") {
    return;
  }

  panel.dataset.bound = "true";

  panel.addEventListener("click", async (event) => {
    const starButton = event.target.closest("[data-rating]");
    if (starButton) {
      event.preventDefault();
      event.stopPropagation();

      try {
        await submitChapterRating(Number(starButton.dataset.rating));
      } catch (error) {
        window.MangakuAlerts?.showError?.(
          error.message || "Gagal menyimpan rating.",
        );
      }
      return;
    }

    const reactionButton = event.target.closest("[data-reaction]");
    if (reactionButton) {
      event.preventDefault();
      event.stopPropagation();

      try {
        await submitChapterReaction(reactionButton.dataset.reaction);
      } catch (error) {
        window.MangakuAlerts?.showError?.(
          error.message || "Gagal menyimpan reaksi.",
        );
      }
      return;
    }

    const deleteButton = event.target.closest(".chapter-comment-delete");
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();

      try {
        await deleteChapterComment(Number(deleteButton.dataset.commentId));
      } catch (error) {
        window.MangakuAlerts?.showError?.(
          error.message || "Gagal menghapus komentar.",
        );
      }
    }
  });

  const form =
    state.dom?.chapterCommentForm ||
    document.getElementById("chapterCommentForm");

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const input =
        state.dom?.chapterCommentInput ||
        document.getElementById("chapterCommentInput");
      const body = String(input?.value || "").trim();

      if (!body) {
        return;
      }

      try {
        await submitChapterComment(body);
        if (input) {
          input.value = "";
        }
      } catch (error) {
        window.MangakuAlerts?.showError?.(
          error.message || "Gagal mengirim komentar.",
        );
      }
    });
  }
}

async function fetchReaderData(route) {
  const url = `${READER_ENDPOINT}/${route.slug}/${route.chapter}`;

  try {
    const { response, result, ok } = await window.MangakuApi.raw("GET", url);

    return {
      ok,
      status: response.status,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      result: { message: error.message },
    };
  }
}

async function navigateToReader(href) {
  if (!href) {
    return;
  }

  window.location.href = href;
}

async function startReadingSession() {
  if (!state.reader) {
    return;
  }

  const { book, chapter } = state.reader;

  state.session = {
    bookId: book.id,
    chapterId: chapter.id,
    startedAt: Date.now(),
  };
}

async function flushReadingSession(options = {}) {
  if (!state.session) {
    return;
  }

  const elapsed = Math.floor((Date.now() - state.session.startedAt) / 1000);

  if (elapsed < MIN_SESSION_SECONDS) {
    return;
  }

  const payload = {
    bookId: state.session.bookId,
    chapterId: state.session.chapterId,
    durationSeconds: elapsed,
  };

  try {
    await window.MangakuApi.raw(
      "POST",
      `/api/books/${state.session.bookId}/reading-sessions`,
      {
        payload,
        redirectOn401: false,
      },
    );
  } catch (error) {
    console.warn("Error flushing reading session:", error.message);
  }

  state.session.startedAt = Date.now();
}

function setReaderSidebarOpen(isOpen) {
  const rightSidebar =
    state.dom?.rightSidebar || document.getElementById("readerRightSidebar");
  const overlay =
    state.dom?.sidebarOverlay ||
    document.getElementById("readerSidebarOverlay");

  if (rightSidebar) {
    rightSidebar.classList.toggle("is-open", isOpen);
  }

  document.body.classList.toggle("reader-sidebar-open", isOpen);

  if (overlay) {
    overlay.hidden = !isOpen;
  }
}

function attachReaderInteractions() {
  const rightSidebar =
    state.dom?.rightSidebar || document.getElementById("readerRightSidebar");
  const rightSidebarClose =
    state.dom?.rightSidebarClose || document.getElementById("readerRightClose");
  const sidebarOverlay =
    state.dom?.sidebarOverlay ||
    document.getElementById("readerSidebarOverlay");
  const rightToggle =
    state.dom?.rightToggle || document.getElementById("readerRightToggle");
  const headerToggle =
    state.dom?.headerToggle || document.getElementById("readerHeaderToggle");

  if (rightToggle && rightSidebar) {
    rightToggle.addEventListener("click", () => {
      setReaderSidebarOpen(!rightSidebar.classList.contains("is-open"));
    });
  }

  if (rightSidebarClose && rightSidebar) {
    rightSidebarClose.addEventListener("click", () => {
      setReaderSidebarOpen(false);
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
      setReaderSidebarOpen(false);
    });
  }

  if (headerToggle) {
    headerToggle.addEventListener("click", () => {
      document.body.classList.toggle("reader-header-collapsed");
      syncReaderHeaderControls();
    });
  }

  const headerRestore =
    state.dom?.headerRestore || document.getElementById("readerHeaderRestore");

  if (headerRestore) {
    headerRestore.addEventListener("click", () => {
      document.body.classList.remove("reader-header-collapsed");
      syncReaderHeaderControls();
    });
  }

  const attachChapterNavButton = (button, direction) => {
    if (!button) {
      return;
    }

    button.addEventListener("click", async () => {
      if (button.disabled) {
        return;
      }

      const href = button.dataset.href;
      if (href) {
        await navigateToReader(href);
      }
    });
  };

  attachChapterNavButton(
    state.dom?.prevButton || document.getElementById("readerPrevButton"),
    -1,
  );
  attachChapterNavButton(
    state.dom?.nextButton || document.getElementById("readerNextButton"),
    1,
  );

  document.body.addEventListener("click", async (event) => {
    const link = event.target.closest("[data-reader-link]");

    if (!link) {
      return;
    }

    setReaderSidebarOpen(false);
    event.preventDefault();
    await navigateToReader(link.getAttribute("href"));
  });

  window.addEventListener("keydown", async (event) => {
    const activeTag = document.activeElement?.tagName?.toLowerCase();

    if (
      activeTag === "input" ||
      activeTag === "textarea" ||
      activeTag === "select"
    ) {
      return;
    }

    if (event.key === "ArrowLeft") {
      const href = getAdjacentChapterHref(-1);
      if (href) {
        event.preventDefault();
        await navigateToReader(href);
      }
      return;
    }

    if (event.key === "ArrowRight") {
      const href = getAdjacentChapterHref(1);
      if (href) {
        event.preventDefault();
        await navigateToReader(href);
      }
    }

    if (event.key === "Escape") {
      setReaderSidebarOpen(false);
    }
  });

  window.addEventListener("beforeunload", () => {
    flushReadingSession({ background: true }).catch(() => {});
  });
}

async function initReaderPage() {
  const pageMarker = document.getElementById("readerContent");

  if (!pageMarker) {
    return;
  }

  try {
    await window.MangakuSession.refreshCurrentUserSession();
  } catch (error) {
    console.warn("Reader session refresh warning:", error.message);
  }

  state.currentUser = getCurrentUserSession();

  if (!state.currentUser) {
    redirectToLogin();
    return;
  }

  hydrateReaderIdentity();
  cacheReaderDom();
  document.body.classList.add("reader-nav-visible");
  syncReaderHeaderControls();
  attachReaderInteractions();
  attachEngagementInteractions();

  const route = parseReaderRoute();

  if (!route) {
    return;
  }

  try {
    const { ok, status, result } = await fetchReaderData(route);

    if (!ok && status === 404) {
      renderReaderNotFound(result.message);
      return;
    }

    if (!ok) {
      throw new Error(result.message || "Gagal memuat halaman reader.");
    }

    renderReader(result.data);
    startReadingSession();
  } catch (error) {
    renderReaderNotFound(error.message || "Gagal memuat halaman reader.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initReaderPage();
});
