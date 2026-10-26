/* ============================================================
   ANIME/DB — script.js (vanilla JS, no frameworks)
   One file renders BOTH pages from the same data layer:
   - index.html  -> browse grid, featured hero, filters, search
   - anime.html  -> detail page, loaded by ?id=<anime id>

   ------------------------------------------------------------
   DATA LAYER — this is the one place to change to use a real API
   ------------------------------------------------------------
   Local mode (default): DB_CONFIG.source = 'anime.json'.
   The file can be a bare array OR { "anime": [...] }.

   Jikan swap (MyAnimeList API, no key needed):
     1. Set source to a Jikan endpoint, e.g.
        'https://api.jikan.moe/v4/top/anime?limit=25'
        and mode to 'jikan'.
     2. fromJikan() below already maps Jikan's fields onto the
        local shape. Jikan has no IMDb or community score, so
        those render as "—" until you supply them from elsewhere.
     3. For a single title: 'https://api.jikan.moe/v4/anime/<id>'.

   AniList swap: AniList is GraphQL (POST). Replace loadAnime()'s
   fetch with a POST to https://graphql.anilist.co carrying your
   query, then map its fields in a fromAniList() next to
   fromJikan(). Nothing else in this file needs to change —
   every renderer below only reads the normalized shape.
   ============================================================ */
'use strict';

/* ---------------- Data layer ---------------- */
const DB_CONFIG = {
  source: 'anime.json',
  mode: 'local' // 'local' | 'jikan'
};

const DEFAULT_ACCENT = '#d9a441';

async function loadAnime() {
  const res = await fetch(DB_CONFIG.source);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : (raw.anime || raw.data || []);
  return list.map(normalizeAnime).filter(a => a.id && a.title);
}

/* Normalize any source into the one shape the renderers use. */
function normalizeAnime(a) {
  if (DB_CONFIG.mode === 'jikan') return fromJikan(a);
  return {
    id: a.id,
    title: a.title,
    year: a.year || null,
    genres: Array.isArray(a.genres) ? a.genres : [],
    studio: a.studio || 'Unknown studio',
    poster: a.poster || '',
    banner: a.banner || a.poster || '',
    accent: isHex(a.accent) ? a.accent : DEFAULT_ACCENT,
    ratings: {
      mal: num(a.ratings && a.ratings.mal),
      imdb: num(a.ratings && a.ratings.imdb),
      community: num(a.ratings && a.ratings.community)
    },
    synopsis: Array.isArray(a.synopsis) ? a.synopsis : (a.synopsis ? [a.synopsis] : []),
    quote: a.quote || null,
    characters: Array.isArray(a.characters) ? a.characters : [],
    writer: a.writer || null,
    episodes: (a.episodes === undefined || a.episodes === null) ? null : a.episodes,
    status: a.status || '',
    tagline: a.tagline || ''
  };
}

/* Jikan v4 -> local shape. Scores: Jikan only supplies MAL. */
function fromJikan(a) {
  return {
    id: String(a.mal_id),
    title: (a.title_english || a.title) || '',
    year: a.year || (a.aired && a.aired.from ? new Date(a.aired.from).getFullYear() : null),
    genres: (a.genres || []).map(g => g.name),
    studio: (a.studios && a.studios[0] && a.studios[0].name) || 'Unknown studio',
    poster: (a.images && a.images.jpg && a.images.jpg.image_url) || '',
    banner: (a.images && a.images.jpg && a.images.jpg.large_image_url) || '',
    accent: DEFAULT_ACCENT,
    ratings: { mal: num(a.score), imdb: null, community: null },
    synopsis: a.synopsis ? [a.synopsis] : [],
    quote: null,
    characters: [], // fill via /anime/{id}/characters if you need them
    writer: null,
    episodes: a.episodes || null,
    status: a.status || '',
    tagline: ''
  };
}

/* ---------------- Small helpers ---------------- */
function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
function isHex(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}
function fmtScore(v) { return v === null ? '—' : v.toFixed(2).replace(/0$/, ''); }

/* Poster fallback: a broken poster URL becomes a typographic
   monogram panel instead of a broken-image icon. Called from
   inline onerror handlers on every <img> this file renders. */
window.handlePosterError = function (img) {
  const d = document.createElement('div');
  d.className = 'poster-fallback';
  d.innerHTML = '<span>' + esc(initials(img.alt || '?')) + '</span>';
  img.replaceWith(d);
};

/* Scroll fade-ins. Called after every render that adds .reveal nodes. */
const revealObserver = ('IntersectionObserver' in window)
  ? new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
    }, { threshold: 0.12 })
  : null;
function watchReveals(root) {
  (root || document).querySelectorAll('.reveal').forEach(el => {
    if (revealObserver) revealObserver.observe(el);
    else el.classList.add('visible');
  });
}

/* ---------------- Shared bits ---------------- */
function cardHTML(a) {
  return '<article class="card reveal">' +
    '<a href="anime.html?id=' + encodeURIComponent(a.id) + '" aria-label="' + esc(a.title) + '">' +
      '<div class="card-art">' +
        (a.poster
          ? '<img src="' + esc(a.poster) + '" alt="' + esc(a.title) + '" loading="lazy" onerror="handlePosterError(this)">'
          : '<div class="poster-fallback"><span>' + esc(initials(a.title)) + '</span></div>') +
      '</div>' +
      '<div class="card-meta"><h3>' + esc(a.title) + '</h3>' +
      '<span class="score">MAL <b>' + fmtScore(a.ratings.mal) + '</b></span></div>' +
    '</a></article>';
}

/* ============================================================
   BROWSE PAGE (index.html)
   ============================================================ */
const YEAR_BANDS = ['All', '1990s', '2000s', '2010s', '2020s'];
const RATING_BANDS = [
  { label: 'All', min: 0 },
  { label: '9.0+', min: 9.0 },
  { label: '8.5+', min: 8.5 },
  { label: '8.0+', min: 8.0 }
];

function yearBand(year) {
  if (!year) return '';
  if (year < 2000) return '1990s';
  if (year < 2010) return '2000s';
  if (year < 2020) return '2010s';
  return '2020s';
}

function initBrowse(all) {
  const state = { query: '', genre: 'All', year: 'All', rating: 'All' };
  const grid = document.getElementById('grid');
  const resultLine = document.getElementById('result-line');
  const search = document.getElementById('search');

  /* ----- Filter chips (built from the data, not hardcoded) ----- */
  const genres = ['All'].concat([...new Set(all.flatMap(a => a.genres))].sort());
  buildChips(document.getElementById('genre-filters'), genres, 'genre');
  buildChips(document.getElementById('year-filters'), YEAR_BANDS, 'year');
  buildChips(document.getElementById('rating-filters'), RATING_BANDS.map(r => r.label), 'rating');

  function buildChips(container, values, key) {
    container.innerHTML = values.map((v, i) =>
      '<button type="button" class="chip' + (i === 0 ? ' active' : '') + '" data-value="' + esc(v) + '">' + esc(v) + '</button>'
    ).join('');
    container.addEventListener('click', e => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      state[key] = btn.dataset.value;
      renderGrid();
    });
  }

  /* ----- Featured hero: random on load, "Next" cycles ----- */
  let featuredIndex = Math.floor(Math.random() * all.length);
  const heroArt = document.getElementById('hero-art');
  const heroTitle = document.getElementById('hero-title');
  const heroTagline = document.getElementById('hero-tagline');
  const heroMeta = document.getElementById('hero-meta');
  const heroView = document.getElementById('hero-view');

  function renderFeatured() {
    const a = all[featuredIndex];
    heroArt.innerHTML = a.poster
      ? '<img src="' + esc(a.poster) + '" alt="' + esc(a.title) + '" onerror="handlePosterError(this)">'
      : '<div class="poster-fallback"><span>' + esc(initials(a.title)) + '</span></div>';
    heroTitle.innerHTML = '<a href="anime.html?id=' + encodeURIComponent(a.id) + '">' + esc(a.title) + '</a>';
    heroTagline.textContent = a.tagline;
    heroMeta.innerHTML = 'MAL <strong>' + fmtScore(a.ratings.mal) + '</strong> &nbsp;·&nbsp; ' +
      esc(a.year || '—') + ' &nbsp;·&nbsp; ' + esc(a.studio) + ' &nbsp;·&nbsp; ' + esc(a.genres.join(' / '));
    heroView.href = 'anime.html?id=' + encodeURIComponent(a.id);
  }
  document.getElementById('hero-next').addEventListener('click', () => {
    featuredIndex = (featuredIndex + 1) % all.length;
    renderFeatured();
  });
  renderFeatured();

  /* ----- Grid + live search ----- */
  function matches(a) {
    if (state.genre !== 'All' && !a.genres.includes(state.genre)) return false;
    if (state.year !== 'All' && yearBand(a.year) !== state.year) return false;
    if (state.rating !== 'All') {
      const min = RATING_BANDS.find(r => r.label === state.rating).min;
      if (a.ratings.mal === null || a.ratings.mal < min) return false;
    }
    if (state.query) {
      const q = state.query.toLowerCase();
      const hay = (a.title + ' ' + a.genres.join(' ') + ' ' + a.studio).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function renderGrid() {
    const list = all.filter(matches);
    grid.innerHTML = list.length
      ? list.map(cardHTML).join('')
      : '<div class="empty"><p>No titles match those filters.</p>' +
        '<p><button type="button" id="clear-filters">Clear all filters</button></p></div>';
    resultLine.innerHTML = 'Showing <b>' + list.length + '</b> of ' + all.length + ' titles';
    const clear = document.getElementById('clear-filters');
    if (clear) clear.addEventListener('click', () => {
      state.query = ''; state.genre = 'All'; state.year = 'All'; state.rating = 'All';
      search.value = '';
      document.querySelectorAll('.filters .chip').forEach(c => c.classList.toggle('active', c.dataset.value === 'All'));
      renderGrid();
    });
    watchReveals(grid);
  }

  let debounce = null;
  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.query = search.value.trim(); renderGrid(); }, 120);
  });

  renderGrid();
}

/* ============================================================
   DETAIL PAGE (anime.html?id=...)
   ============================================================ */
function initDetail(all) {
  const id = new URLSearchParams(window.location.search).get('id');
  const a = all.find(x => x.id === id);
  const root = document.getElementById('detail-root');
  if (!a) {
    root.innerHTML = '<div class="error"><h2>Title not found</h2>' +
      '<p>No anime with id "' + esc(id) + '" exists in the database.</p>' +
      '<p><a class="btn-text" href="index.html">Back to all anime</a></p></div>';
    return;
  }

  /* Per-anime accent, pulled from the key art palette (stored in
     the JSON as "accent"). Falls back to the default amber. */
  document.documentElement.style.setProperty('--accent', a.accent);
  document.title = a.title + ' — ANIME/DB';

  const metaBits = [a.year, a.studio, a.episodes ? a.episodes + (a.episodes === 1 ? ' film' : ' episodes') : null, a.status]
    .filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');

  root.innerHTML =
    /* Hero */
    '<section class="detail-hero"><div class="hero-media">' +
      (a.banner
        ? '<img src="' + esc(a.banner) + '" alt="" onerror="handlePosterError(this)">'
        : '<div class="poster-fallback"><span>' + esc(initials(a.title)) + '</span></div>') +
    '</div><div class="hero-shade"></div>' +
    '<div class="wrap"><p class="eyebrow">Anime &nbsp;/&nbsp; ' + esc(a.year || '') + '</p>' +
    '<h1 class="detail-title">' + esc(a.title) + '</h1>' +
    '<div class="tag-row">' + a.genres.map(g => '<span class="tag">' + esc(g) + '</span>').join('') + '</div>' +
    '<p class="detail-meta">' + metaBits + '</p></div></section>' +
    '<div class="wrap">' +
    /* Ratings */
    '<section class="ratings reveal">' + ratingBlock('MyAnimeList', a.ratings.mal) +
      ratingBlock('IMDb', a.ratings.imdb) + ratingBlock('Community', a.ratings.community) + '</section>' +
    /* Story */
    '<section><div class="sec-head"><span class="sec-no">01</span><h2>Story sneak peek</h2><hr class="rule"></div>' +
    '<div class="story">' + a.synopsis.map(p => '<p>' + esc(p) + '</p>').join('') +
    (a.quote
      ? '<figure class="pull-quote"><blockquote>' + esc(a.quote.text) + '</blockquote>' +
        '<cite>— ' + esc(a.quote.source) + '</cite></figure>'
      : '') +
    '</div></section>' +
    /* Characters */
    '<section><div class="sec-head"><span class="sec-no">02</span><h2>Characters</h2><hr class="rule"></div>' +
    '<div class="char-strip">' + a.characters.map(charHTML).join('') + '</div></section>' +
    /* Writer */
    (a.writer
      ? '<section><div class="sec-head"><span class="sec-no">03</span><h2>Writer / Creator</h2><hr class="rule"></div>' +
        '<div class="writer"><div><h3>' + esc(a.writer.name) + '</h3></div>' +
        '<div><p>' + esc(a.writer.bio) + '</p>' +
        '<ul class="works"><li><span>Other works</span></li>' +
        a.writer.otherWorks.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div></div></section>'
      : '') +
    /* Related */
    '<section><div class="sec-head"><span class="sec-no">04</span><h2>More like this</h2><hr class="rule"></div>' +
    '<div class="related-grid">' + relatedAnime(all, a).map(cardHTML).join('') + '</div></section>' +
    '</div>';

  /* Animate the rating bars after first paint (CSS transition does the rest). */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('.bar span').forEach(span => { span.style.width = span.dataset.width + '%'; });
  }));
  watchReveals(root);
}

function ratingBlock(label, score) {
  const pct = score === null ? 0 : Math.min(100, (score / 10) * 100);
  return '<div class="rating"><p class="src">' + esc(label) + '</p>' +
    '<p class="num">' + fmtScore(score) + '<small> / 10</small></p>' +
    '<div class="bar"><span data-width="' + pct.toFixed(1) + '"></span></div></div>';
}

function charHTML(c) {
  const portrait = c.image
    ? '<img src="' + esc(c.image) + '" alt="' + esc(c.name) + '" loading="lazy" onerror="handlePosterError(this)">'
    : '<span class="mono">' + esc(initials(c.name)) + '</span>';
  return '<article class="char-card"><div class="char-portrait">' + portrait + '</div>' +
    '<div class="char-body"><h3>' + esc(c.name) + '</h3>' +
    '<p class="role">' + esc(c.role) + '</p>' +
    '<p class="char-trait">' + esc(c.trait) + '</p></div></article>';
}

/* Related = strongest genre overlap first; top up by MAL score. */
function relatedAnime(all, current) {
  const scored = all
    .filter(a => a.id !== current.id)
    .map(a => ({ a, overlap: a.genres.filter(g => current.genres.includes(g)).length }))
    .sort((x, y) => (y.overlap - x.overlap) || ((y.a.ratings.mal || 0) - (x.a.ratings.mal || 0)));
  return scored.slice(0, 4).map(x => x.a);
}

/* ---------------- Boot ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  document.body.classList.add('ready');
  const page = document.body.dataset.page;
  const mount = document.getElementById('app-error');
  try {
    const all = await loadAnime();
    if (!all.length) throw new Error('empty dataset');
    if (page === 'browse') initBrowse(all);
    else if (page === 'detail') initDetail(all);
  } catch (err) {
    if (mount) {
      mount.innerHTML = '<div class="error"><h2>Could not load the database</h2>' +
        '<p>' + esc(err.message) + '</p>' +
        '<p>Open this site through a local server (opening the file directly blocks data loading in most browsers):</p>' +
        '<p><code>python3 -m http.server</code> &nbsp;then visit <code>http://localhost:8000</code></p></div>';
    }
  }
});
