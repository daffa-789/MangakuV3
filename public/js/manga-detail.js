const STATUS_LABELS = {
  reading: "Berjalan",
  completed: "Selesai",
  to_read: "Rencana",
};

const GENRE_OPTIONS = [
  { value: "action", label: "Action" },
  { value: "adventure", label: "Adventure" },
  { value: "comedy", label: "Comedy" },
  { value: "drama", label: "Drama" },
  { value: "fantasy", label: "Fantasy" },
  { value: "horror", label: "Horror" },
  { value: "mystery", label: "Mystery" },
  { value: "romance", label: "Romance" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "slice-of-life", label: "Slice of Life" },
  { value: "sports", label: "Sports" },
  { value: "supernatural", label: "Supernatural" },
  { value: "thriller", label: "Thriller" },
  { value: "parody", label: "Parody" },
  { value: "general", label: "General" },
];

const state = {
  book: null,
};

const { escapeHtml, formatDate, renderImageWithFallback } = window.MangakuCore;

function parseSlugFromPath() {
  const match = window.location.pathname.match(/^\/manga\/([^/]+)\/?$/i);
  return match ? decodeURIComponent(match[1]) : null;
}

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

function renderBanner(book) {
  const banner = document.getElementById("mangaDetailBanner");

  if (!banner || !book?.thumbnailUrl) {
    return;
  }

  banner.hidden = false;
  banner.style.backgroundImage = `url("${book.thumbnailUrl}")`;
}

function renderDetail(book) {
  const container = document.getElementById("mangaDetailContent");
  const firstChapter = book.chapters?.find(
    (chapter) => Number(chapter.pageCount || 0) > 0,
  );
  const readUrl = firstChapter
    ? getReaderUrl(book, firstChapter.chapterNumber)
    : null;
  const ratingText =
    Number(book.ratingCount || 0) > 0
      ? `${Number(book.averageRating || 0).toFixed(1)} (${book.ratingCount} rating)`
      : "Belum ada rating";

  const chaptersHtml = (book.chapters || [])
    .map((chapter) => {
      const chapterUrl = getReaderUrl(book, chapter.chapterNumber);
      return chapterUrl
        ? `<a class="manga-detail-chapter-link" href="${chapterUrl}">
            Chapter ${chapter.chapterNumber}
            <span>${Number(chapter.pageCount || 0)} halaman</span>
          </a>`
        : `<span class="manga-detail-chapter-link is-disabled">
            Chapter ${chapter.chapterNumber}
            <span>Belum tersedia</span>
          </span>`;
    })
    .join("");

  container.innerHTML = `
    <div class="manga-detail-hero">
      <div class="manga-detail-cover">
        ${renderImageWithFallback(book.thumbnailUrl, `Cover ${book.title}`, "Manga")}
      </div>
      <div class="manga-detail-info">
        <p class="eyebrow">Detail Manga</p>
        <h1>${escapeHtml(book.title)}</h1>
        <p class="manga-detail-author">${escapeHtml(book.author || "-")}</p>
        <div class="manga-detail-tags">
          <span class="tag-chip">${escapeHtml(getStatusLabel(book.status))}</span>
          ${(book.genres || [])
            .map(
              (genre) =>
                `<span class="tag-chip">${escapeHtml(
                  GENRE_OPTIONS.find((option) => option.value === genre)?.label ||
                    genre,
                )}</span>`,
            )
            .join("")}
        </div>
        <div class="manga-detail-stats">
          <span><i class="bi bi-star-fill"></i> ${ratingText}</span>
          <span><i class="bi bi-journal-text"></i> ${book.chapterCount || 0} chapter</span>
          <span><i class="bi bi-calendar3"></i> ${escapeHtml(formatDate(book.publishedOn))}</span>
        </div>
        <div class="button-row manga-detail-actions">
          ${
            readUrl
              ? `<a class="primary-button" href="${readUrl}">
                  <i class="bi bi-book" aria-hidden="true"></i> Baca
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
            ${book.isFavorite ? "Hapus Favorit" : "Tambah Favorit"}
          </button>
        </div>
      </div>
    </div>

    <section class="manga-detail-synopsis">
      <h2>Sinopsis</h2>
      <p>${escapeHtml(book.description || "Sinopsis belum tersedia.")}</p>
    </section>

    <section class="manga-detail-chapters">
      <h2>Daftar Chapter</h2>
      <div class="manga-detail-chapter-list">
        ${chaptersHtml || '<p class="empty-state">Belum ada chapter.</p>'}
      </div>
    </section>
  `;

  renderBanner(book);
  attachFavoriteButton();
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
