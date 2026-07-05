const state = {
  book: null,
  synopsisExpanded: false,
};

const {
  escapeHtml,
  formatDate,
  renderImageWithFallback,
  GENRE_OPTIONS,
  getStatusLabel,
  getReaderUrl,
} = window.MangakuCore;

function getStatusClass(status) {
  const map = {
    reading: "status-reading",
    completed: "status-completed",
    to_read: "status-to_read",
  };
  return map[String(status || "reading")] || "status-reading";
}

function parseSlugFromPath() {
  const match = window.location.pathname.match(/^\/manga\/([^/]+)\/?$/i);
  return match ? decodeURIComponent(match[1]) : null;
}


function renderTopbarTitle(book) {
  const el = document.getElementById("mangaDetailTopbarTitle");
  if (el && book?.title) {
    el.textContent = book.title;
  }
}

function renderDetail(book) {
  const container = document.getElementById("mangaDetailContent");
  const firstChapter = book.chapters?.find(
    (chapter) => Number(chapter.pageCount || 0) > 0,
  );
  const readUrl = firstChapter
    ? getReaderUrl(book, firstChapter.chapterNumber)
    : null;
  const avgRating = Number(book.averageRating || 0);
  const ratingCount = Number(book.ratingCount || 0);

  // Genre tags with color classes
  const genreTagsHtml = (book.genres || [])
    .map((genre) => {
      const option = GENRE_OPTIONS.find((o) => o.value === genre);
      const label = option?.label || genre;
      const cssClass = option ? `genre-${option.value}` : "";
      return `<span class="tag-chip ${cssClass}">${escapeHtml(label)}</span>`;
    })
    .join("");

  // Status tag
  const statusTag = `<span class="tag-chip tag-status ${getStatusClass(book.status)}">${escapeHtml(getStatusLabel(book.status))}</span>`;

  // Stats
  const statsHtml = `
    <div class="stat-item">
      <i class="bi bi-star-fill" style="color: #ffc107;"></i>
      <span class="stat-value">${avgRating > 0 ? avgRating.toFixed(1) : "-"}</span>
      <span class="stat-label">(${ratingCount} rating)</span>
    </div>
    <div class="stat-item">
      <i class="bi bi-book" style="color: var(--accent-blue);"></i>
      <span class="stat-value">${book.chapterCount || 0}</span>
      <span class="stat-label">Chapter</span>
    </div>
    <div class="stat-item">
      <i class="bi bi-calendar3" style="color: var(--accent-green);"></i>
      <span class="stat-value">${escapeHtml(formatDate(book.publishedOn))}</span>
    </div>
  `;

  // Chapters list
  const chaptersHtml = (book.chapters || [])
    .map((chapter) => {
      const chapterUrl = getReaderUrl(book, chapter.chapterNumber);
      const pageCount = Number(chapter.pageCount || 0);
      return chapterUrl
        ? `<a class="manga-detail-chapter-link" href="${chapterUrl}">
            <span class="chapter-title">Ch. ${chapter.chapterNumber}</span>
            <span class="chapter-meta">${pageCount} hal</span>
            <span class="chapter-date">${escapeHtml(formatDate(chapter.createdAt))}</span>
          </a>`
        : `<span class="manga-detail-chapter-link is-disabled">
            <span class="chapter-title">Ch. ${chapter.chapterNumber}</span>
            <span class="chapter-meta">Belum tersedia</span>
            <span class="chapter-date"></span>
          </span>`;
    })
    .join("");

  // Synopsis - check if long enough for toggle
  const description = book.description || "Sinopsis belum tersedia.";
  const isLongSynopsis = description.length > 200;

  container.innerHTML = `
    <div class="manga-detail-hero">
      <div class="manga-detail-cover">
        ${renderImageWithFallback(book.thumbnailUrl, `Cover ${book.title}`, "Manga")}
      </div>
      <div class="manga-detail-info">
        <h1>${escapeHtml(book.title)}</h1>
        <p class="manga-detail-author">
          <i class="bi bi-person-fill"></i>
          ${escapeHtml(book.author || "Unknown Author")}
        </p>
        <div class="manga-detail-tags">
          ${statusTag}
          ${genreTagsHtml}
        </div>
        <div class="manga-detail-stats">
          ${statsHtml}
        </div>
        <div class="button-row manga-detail-actions">
          ${
            readUrl
              ? `<a class="primary-button" href="${readUrl}">
                  <i class="bi bi-book" aria-hidden="true"></i> Baca Sekarang
                </a>`
              : `<button type="button" class="secondary-button" disabled>Belum Ada Chapter</button>`
          }
          <button
            type="button"
            id="mangaFavoriteButton"
            class="secondary-button"
            data-book-id="${book.id}"
            data-is-favorite="${book.isFavorite ? "true" : "false"}">
            <i class="bi bi-heart${book.isFavorite ? "-fill" : ""}" aria-hidden="true"></i>
            ${book.isFavorite ? "Favorit" : "Favorit"}
          </button>
        </div>
      </div>
    </div>

    <section class="manga-detail-synopsis">
      <h2><i class="bi bi-file-text"></i> Sinopsis</h2>
      <div class="synopsis-text ${isLongSynopsis && !state.synopsisExpanded ? "collapsed" : "expanded"}">
        <p>${escapeHtml(description)}</p>
      </div>
      ${
        isLongSynopsis
          ? `<button type="button" class="synopsis-toggle" id="synopsisToggle">
              <span>${state.synopsisExpanded ? "Tutup" : "Baca selengkapnya"}</span>
              <i class="bi bi-chevron-${state.synopsisExpanded ? "up" : "down"}"></i>
            </button>`
          : ""
      }
    </section>

    <section class="manga-detail-chapters">
      <h2>
        <i class="bi bi-list-ul"></i> Daftar Chapter
        <span class="chapter-count">${book.chapters?.length || 0} chapter</span>
      </h2>
      <div class="manga-detail-chapter-list">
        ${chaptersHtml || '<p class="empty-state">Belum ada chapter.</p>'}
      </div>
    </section>
  `;

  renderTopbarTitle(book);
  attachFavoriteButton();
  attachSynopsisToggle();
}

function attachFavoriteButton() {
  const button = document.getElementById("mangaFavoriteButton");

  if (!button || button.dataset.bound === "true") {
    return;
  }

  button.dataset.bound = "true";

  button.addEventListener("click", async () => {
    const bookId = Number(button.dataset.bookId);
    const isFavorite = button.dataset.isFavorite === "true";

    if (!bookId) {
      return;
    }

    button.disabled = true;

    try {
      await window.MangakuApi.post(`/api/books/${bookId}/favorite`, {
        favorite: !isFavorite,
      });

      state.book.isFavorite = !isFavorite;
      renderDetail(state.book);
    } catch (error) {
      window.MangakuAlerts?.showError?.(
        error.message || "Gagal memperbarui favorit.",
      );
    } finally {
      button.disabled = false;
    }
  });
}

function attachSynopsisToggle() {
  const toggle = document.getElementById("synopsisToggle");
  if (!toggle || toggle.dataset.bound === "true") {
    return;
  }
  toggle.dataset.bound = "true";

  toggle.addEventListener("click", () => {
    state.synopsisExpanded = !state.synopsisExpanded;
    const textEl = document.querySelector(".synopsis-text");
    if (textEl) {
      textEl.className = `synopsis-text ${state.synopsisExpanded ? "expanded" : "collapsed"}`;
    }
    const label = toggle.querySelector("span");
    const icon = toggle.querySelector("i");
    if (label) label.textContent = state.synopsisExpanded ? "Tutup" : "Baca selengkapnya";
    if (icon) icon.className = `bi bi-chevron-${state.synopsisExpanded ? "up" : "down"}`;
  });
}


function renderNotFound(message) {
  const container = document.getElementById("mangaDetailContent");
  container.innerHTML = `
    <div class="empty-state">
      <i class="bi bi-exclamation-circle"></i>
      <p>${escapeHtml(message || "Manga tidak ditemukan.")}</p>
      <a class="primary-button" href="/home.html">Kembali ke Beranda</a>
    </div>
  `;
}

async function loadMangaDetail() {
  const slug = parseSlugFromPath();

  if (!slug) {
    renderNotFound("Slug manga tidak valid.");
    return;
  }

  try {
    const result = await window.MangakuApi.get(
      `/api/books/slug/${encodeURIComponent(slug)}`,
    );
    state.book = result.data;
    renderDetail(state.book);
  } catch (error) {
    renderNotFound(error.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadMangaDetail();
});