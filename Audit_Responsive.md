
**Tanggal Audit**: 29 Juni 2026  
**Terakhir Diperbarui**: 4 Juli 2026  
**Breakpoint**: 3 media query — Tablet (≤768px), Small Tablet (≤600px), Mobile (≤480px)  
**Standar HP 2026**: Layar ~6.1"–6.9", viewport 360–430px (mobile), 768px (tablet/foldable)

---

## 1. File yang Dimodifikasi

| File | Perubahan |
|------|-----------|
| `public/css/styles.css` | Hapus media query lama `@media (max-width: 430px)`, ganti 3 breakpoint baru (tablet ≤768px, small tablet ≤600px, mobile ≤480px), tambah `.sidebar-toggle`, `.sidebar-overlay`, `.reader-tap-zone`, `.reader-sidebar-overlay`, `.log-toolbar` |
| `public/home.html` | Tambah tombol hamburger `#sidebarToggle` dan `#sidebarOverlay` di dalam `<body>` |
| `public/js/dashboard.js` | Tambah `attachSidebarToggle()`, perbaiki `requestJson`/`setBodyRoleMode`/`getAuthHeaders`, gunakan destructuring `MangakuCore`, `renderActivityLogs` pakai class `.log-toolbar` + `data-label` untuk mobile stacked layout |
| `public/read.html` | Hapus `reader-mobile-nav` redundan, tambah tap zones kiri/kanan, tambah `#readerSidebarOverlay` |
| `public/js/read.js` | Tap zone navigation, `setReaderSidebarOpen()` dengan overlay backdrop, debounce tap, sync navigasi chapter |
| `public/login.html` | Tidak perlu diubah — sudah responsive via CSS auth-card |
| `public/register.html` | Tidak perlu diubah — sudah responsive via CSS auth-card |

---

## 2. Audit Per Halaman

### 2.1 Login (`login.html`)

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.auth-layout` | max-width: 440px, centered | max-width: 440px | max-width: 100%, padding dikurangi | ✅ OK |
| `.auth-card` | padding: 3rem 2.5rem | padding: 2.5rem 2rem | padding: 2rem 1.25rem, radius: 16px | ✅ OK |
| `.auth-heading h1` | font-size: 2rem | 2rem | 1.625rem | ✅ OK |
| `.auth-form input` | padding: 0.875rem 1rem | tetap | padding: 0.75rem 0.875rem, radius: 10px | ✅ OK |
| `.auth-submit` | padding: 1rem, radius: 12px | tetap | padding: 0.875rem, radius: 10px | ✅ OK |
| `.switch-link` | font-size: 0.9375rem | tetap | font-size: 0.875rem | ✅ OK |
| `.password-input-wrap` | relative positioning | tetap | tetap — input dan toggle tetap rapi | ✅ OK |

### 2.2 Register (`register.html`)

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| Semua komponen | Identik dengan login | Identik dengan login | Identik dengan login | ✅ OK |

> Login & Register menggunakan class yang sama (`.auth-page`, `.auth-card`, `.auth-form`) sehingga satu set media query berlaku untuk keduanya.

### 2.3 Home / Dashboard (`home.html`)

#### 2.3.1 Layout & Sidebar

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.app-shell` | flex, sidebar + main | flex tetap | flex tetap | ✅ OK |
| `.app-sidebar` | width: 200px, static | fixed left, width: 240px, hidden by default, slide-in via `.is-open` | width: 220px, slide-in | ✅ OK |
| `.sidebar-toggle` | hidden | tampil, fixed top-left | ukuran lebih kecil (2.5rem) | ✅ OK |
| `.sidebar-overlay` | hidden | tampil saat sidebar terbuka | tampil saat sidebar terbuka | ✅ OK |
| `.nav-button` | padding: 0.75rem 1rem | tetap | padding: 0.625rem 0.75rem, font lebih kecil | ✅ OK |

#### 2.3.2 Tab Panel & Cards

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.tab-panel` | padding: clamp(1.5rem,2vw,2.5rem) | padding: 1.25rem 1rem | padding: 1rem 0.75rem | ✅ OK |
| `.card` | padding: 1.5rem | padding: 1.25rem | padding: 1rem, radius: 8px | ✅ OK |
| `.section-head` | flex row, space-between | tetap | flex column, gap: 0.5rem | ✅ OK |

#### 2.3.3 Manga Grid (Beranda & Favorit — `renderMangaGrid`)

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.manga-grid` | minmax(160px, 1fr) | minmax(140px, 1fr), gap: 1rem | minmax(120px, 1fr), gap: 0.75rem | ✅ OK |
| `.manga-card-copy` | default padding | tetap | padding: 0.5rem, font kecil | ✅ OK |
| `.manga-card .button-row` | default | tetap | padding & gap lebih kecil | ✅ OK |
| `.small` buttons | default size | tetap | padding & font lebih kecil | ✅ OK |

#### 2.3.4 Edit Manga — Thumbnail Gallery (`renderEditMangaGallery`)

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.editor-layout` | 2-column grid | 1 column | 1 column | ✅ OK |
| `.thumb-gallery` | minmax(130px, 1fr) | minmax(110px, 1fr) | minmax(90px, 1fr) | ✅ OK |
| `.thumb-copy` | padding: 0.875rem | tetap | padding: 0.625rem | ✅ OK |

#### 2.3.5 Tambah/Edit Manga Form

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.field-grid.two-col` | 2 columns | 1 column | 1 column | ✅ OK |
| `.genre-picker` | 2 columns | 2 columns | 1 column | ✅ OK |
| `.form-actions` | flex row | flex row | flex column, button full-width | ✅ OK |
| `.thumbnail-preview img` | max-height: 260px | tetap | max-height: 200px | ✅ OK |

#### 2.3.6 Chapter Management (`renderChapterPageSlots`)

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.page-slot-grid` | minmax(200px, 1fr) | minmax(150px, 1fr) | minmax(130px, 1fr) | ✅ OK |
| `.page-slot-meta` | padding: 0.75rem | tetap | padding: 0.5rem | ✅ OK |
| `.chapter-card` | flex row | flex column, gap: 0.75rem | flex column | ✅ OK |

#### 2.3.7 Database Manga (`renderDatabaseList`)

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.database-list` | minmax(280px, 1fr) | minmax(220px, 1fr) | 1 column | ✅ OK |

#### 2.3.8 User Management (`renderUserRoleList`)

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.user-card` | flex row | flex column | flex column | ✅ OK |
| `.user-actions` | flex column, align end | flex row, wrap | flex row, wrap | ✅ OK |

#### 2.3.9 Activity Logs (`renderActivityLogs`)

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.log-head` | 3-column grid | 3-column (lebih sempit) | hidden | ✅ OK |
| `.log-row` | 3-column grid | 3-column | 1-column stacked | ✅ OK |

### 2.4 Reader (`read.html`)

#### 2.4.1 Header & Layout

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.reader-header` | fixed, auto-hide via toggle | padding lebih kecil, title 1.05rem | height 56px, title 0.9375rem | ✅ OK |
| `.reader-header-back` | 2.5rem | min 44×44px touch target | 2.25rem | ✅ OK |
| `.reader-header-restore` | muncul saat header collapsed | pulse animation | posisi top-left lebih rapat | ✅ OK |
| `.reader-layout` | max-width 1200px, gutter clamp | full width | padding 0.5rem | ✅ OK |

#### 2.4.2 Image & Navigation

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.reader-image` | max-width 980px | max-width 100% | max-height viewport-adjusted | ✅ OK |
| `.reader-view` | radial gradient bg, padding clamp | tetap | padding & radius lebih kecil | ✅ OK |
| `.reader-tap-zone` | hidden | tampil 22% kiri/kanan | tampil, debounce 220ms | ✅ OK |
| `.reader-footer` | hidden (nav via tap/header) | hidden | hidden | ✅ OK |
| Tap pada `.reader-view` | klik kiri/kanan 1/3 layar | tetap | tetap | ✅ OK |

#### 2.4.3 Chapter Sidebar

| Komponen | Desktop | Tablet (≤768px) | Mobile (≤480px) | Status |
|----------|---------|-----------------|-----------------|--------|
| `.reader-right-sidebar` | slide-in dari kanan, 360px | 300–320px, full-height | min(92vw, 280px) | ✅ OK |
| `.reader-sidebar-overlay` | hidden | backdrop gelap saat sidebar terbuka | backdrop gelap | ✅ OK |
| `.reader-chapter-item` | hover highlight | tap-friendly padding | font & padding menyesuaikan | ✅ OK |
| Tutup sidebar | tombol close / Escape | klik overlay / pilih chapter | klik overlay / Escape | ✅ OK |

> Navigasi mobile menggunakan tap zones invisible (bukan bottom bar terpisah) untuk mengurangi duplikasi UI.

---

## 3. Fitur Responsive Baru

### 3.1 Sidebar Hamburger Toggle
- **Komponen**: `#sidebarToggle` (tombol hamburger), `#sidebarOverlay` (backdrop gelap)
- **Perilaku**:
  - Di ≤768px, sidebar tersembunyi off-screen (`transform: translateX(-100%)`)
  - Klik hamburger → sidebar slide-in + overlay muncul
  - Klik overlay / klik navigasi menu → sidebar tertutup otomatis
  - Transisi smooth 300ms
- **Aksesibilitas**: `aria-label="Toggle menu"`, `aria-expanded` di-toggle oleh JS

### 3.2 Breakpoint Strategy
| Breakpoint | Target Device | Viewport |
|------------|---------------|----------|
| ≤768px (Tablet) | iPad Mini, Samsung Galaxy Tab, Foldable terbuka | 601–768px |
| ≤600px (Small Tablet) | Phablet portrait, layar sempit | 481–600px |
| ≤480px (Mobile) | iPhone 16 Pro Max (430px), Samsung S25 Ultra (412px), Pixel 9 Pro (412px) | ≤480px |

> Tidak menggunakan breakpoint >768px karena desktop layout sudah optimal di base CSS.

### 3.3 Reader Chapter Sidebar Overlay
- **Komponen**: `#readerSidebarOverlay` (backdrop gelap di belakang daftar chapter)
- **Perilaku**:
  - Di ≤768px, saat sidebar chapter terbuka → overlay muncul
  - Klik overlay / Escape / pilih chapter → sidebar tertutup
  - Body class `reader-sidebar-open` di-toggle oleh `setReaderSidebarOpen()` di `read.js`

### 3.4 Activity Log Mobile Stacked Cards
- **Komponen**: `.log-row div[data-label]` dengan pseudo-element `::before`
- **Perilaku**: Di ≤480px, header tabel (`.log-head`) disembunyikan; setiap cell menampilkan label via `attr(data-label)`

---

## 4. Komponen dari `dashboard.js` yang Terpengaruh

| Fungsi Render JS | Class HTML yang dihasilkan | Responsive? |
|------------------|---------------------------|-------------|
| `renderMangaGrid()` | `.manga-grid`, `.manga-card`, `.manga-card-cover`, `.manga-card-copy`, `.button-row` | ✅ |
| `renderEditMangaGallery()` | `.thumb-gallery`, `.thumb-card`, `.thumb-image`, `.thumb-copy` | ✅ |
| `renderChapterPageSlots()` | `.page-slot-grid`, `.page-slot-card`, `.page-slot-preview`, `.page-slot-meta` | ✅ |
| `renderDatabaseList()` | `.database-list`, `.database-card`, `.database-cover`, `.database-copy` | ✅ |
| `renderUserRoleList()` | `.user-card`, `.user-copy`, `.user-actions`, `.button-row` | ✅ |
| `renderActivityLogs()` | `.log-table`, `.log-head`, `.log-row` | ✅ |
| `renderEditChapterList()` | `.chapter-card`, `.chapter-copy`, `.button-row` | ✅ |
| `renderGenrePicker()` | `.genre-picker`, `.genre-option` | ✅ |
| `renderEditFormFromSelectedBook()` | `.editor-layout`, `.field-grid.two-col`, `.form-actions` | ✅ |
| `renderFavoritesGrid()` | Reuses `renderMangaGrid` | ✅ |

### 4.1 Fungsi JS Reader (`read.js`)

| Fungsi | Peran Responsive | Status |
|--------|------------------|--------|
| `setReaderSidebarOpen()` | Toggle sidebar + overlay + body class | ✅ |
| `attachReaderInteractions()` | Tap zones, overlay click, Escape key | ✅ |
| `syncNavigationControls()` | Sync tap zone href untuk cross-chapter nav | ✅ |
| `handleDirectionalNavigation()` | Page transition dengan fade 150ms | ✅ |

---

## 5. Ringkasan

- ✅ **Login** — Fully responsive (mobile card lebih compact, input & button menyesuaikan)
- ✅ **Register** — Fully responsive (identik dengan login)
- ✅ **Home/Dashboard** — Fully responsive termasuk:
  - Sidebar off-canvas dengan hamburger toggle
  - Grid manga & thumbnail menyesuaikan kolom
  - Form 2-kolom → 1 kolom di layar kecil
  - Log table → stacked cards di mobile
  - User card → stacked layout di tablet/mobile
  - Chapter card → stacked layout
  - Genre picker → 1 kolom di mobile
- ✅ **Reader** — Responsive (header, image sizing, tap zones, chapter sidebar overlay)
- ✅ Semua komponen JS-rendered sudah ter-cover oleh media query CSS

---

## 6. Penyelesaian Sesi (4 Juli 2026)

### Sudah dikerjakan sebelumnya (AI session terpotong limit)
- Breakpoint CSS tablet/mobile/small-tablet di `styles.css`
- Sidebar hamburger + overlay di dashboard (`home.html`, `dashboard.js`)
- Reader tap zones menggantikan `reader-mobile-nav` yang redundan
- CSS responsive untuk grid manga, form, log table, chapter cards, user cards
- Dokumentasi audit per halaman login, register, dashboard

### Diselesaikan di sesi ini
- **Bug kritis `dashboard.js`**: `requestJson`, `getAuthHeaders`, dan `setBodyRoleMode` dipulihkan setelah refactor `MangakuCore` terpotong — dashboard kembali bisa fetch API
- **`renderActivityLogs`**: inline style diganti class `.log-toolbar` agar responsive CSS mobile berfungsi
- **Reader overlay**: `#readerSidebarOverlay` + `setReaderSidebarOpen()` untuk UX sidebar chapter di tablet/mobile
- **Sidebar toggle hover**: hapus warna abu-abu terang yang kontras buruk di tombol gelap
- **Dokumentasi**: tambah section 2.4 Reader, 3.3–3.4, 4.1, dan catatan penyelesaian sesi

### Tidak ada item tersisa
Semua komponen UI yang diaudit sudah ✅ OK. File backend (`src/routes/auth.js`, `src/routes/books.js`) tidak termasuk scope responsive audit — perubahan di sana (jika ada) terkait fitur/logic backend, bukan layout.