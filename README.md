# ANIME/DB

A multi-anime database site in plain HTML, CSS, and vanilla JavaScript —
no frameworks, no Tailwind, no UI libraries. Browse, search, filter, and
open any title for ratings, characters, writer info, and a spoiler-free
story sneak peek.

## Run it

Because the data loads from `anime.json` with `fetch()`, most browsers
block it when the page is opened straight from the file system. Serve
the folder instead:

```bash
cd anime-db
python3 -m http.server
```

Then visit `http://localhost:8000`. (Any static server works — `npx serve`,
VS Code Live Server, GitHub Pages, etc.)

## Files

- `index.html` — Home / Browse: featured hero, poster grid, filters, live search.
- `anime.html` — Detail template, loaded by `anime.html?id=<id>`. One file
  serves every anime; there are no per-anime pages.
- `style.css` — The whole design system (near-black, off-white, one accent).
- `script.js` — Data layer + both page renderers.
- `anime.json` — The entire database. This is the only file most edits need.

## Add a new anime (no code changes)

Append one object to the `"anime"` array in `anime.json`:

```json
{
  "id": "my-title-slug",
  "title": "My Title",
  "year": 2024,
  "genres": ["Action", "Drama"],
  "studio": "Studio Name",
  "poster": "https://…/poster.jpg",
  "banner": "https://…/banner.jpg",
  "accent": "#d9a441",
  "ratings": { "mal": 8.50, "imdb": 8.4, "community": 8.7 },
  "tagline": "One spoiler-free hook line.",
  "synopsis": ["Line one.", "Line two.", "Line three."],
  "quote": { "text": "A short pull quote.", "source": "Character Name" },
  "characters": [
    { "name": "Name", "role": "Main", "trait": "One-line trait.", "image": null }
  ],
  "writer": {
    "name": "Writer Name",
    "bio": "Two or three sentences.",
    "otherWorks": ["Other Work 1", "Other Work 2"]
  },
  "episodes": 24,
  "status": "Finished"
}
```

Rules that keep it working:

- `id` must be unique and URL-safe — it becomes `anime.html?id=<id>`.
- `banner` may be the same URL as `poster`; the hero crops it wide and
  darkens it with an overlay. Omit it and the poster is used.
- `accent` is the page's accent colour, picked from the key art's palette
  (a real eyedropper read of the poster). Detail pages set it as a CSS
  variable in JS; anything outside the palette range still works, it just
  won't match the art. Omit it and the default amber is used.
- `image: null` on a character renders a typographic monogram tile. Put a
  real image URL there and the renderer uses it instead.
- If a poster URL ever breaks, the site swaps in a monogram panel
  automatically — no broken-image icons, ever.

## Swap the JSON for a real API later

The data layer is the top of `script.js` (`DB_CONFIG` + `loadAnime()` +
`normalizeAnime()`). Everything below it only reads the normalized shape,
so an API swap touches that one section:

- **Jikan (MyAnimeList, no key):** set `source` to a Jikan endpoint and
  `mode` to `'jikan'`. `fromJikan()` already maps its fields. Jikan has
  no IMDb or community score, so those render as "—" until you merge a
  second source.
- **AniList:** it is GraphQL (POST to `https://graphql.anilist.co`). Add a
  `fromAniList()` mapper next to `fromJikan()` and point `loadAnime()` at
  it. The renderers do not change.

## Design notes

- Background `#0d0c0a`, text `#ece7df`, one accent (default amber
  `#d9a441`, overridden per title on detail pages).
- Fonts: Bebas Neue for display type, Inter for body. Nothing else.
- Deliberately avoided: coloured gradients (the detail hero uses a black
  gradient overlay only), glassmorphism, emoji icons, rounded cards with
  big shadows, and centred-everything layouts.
- Motion: 200–300ms hovers, scroll fade-ins via IntersectionObserver, a
  300ms page fade. Respects `prefers-reduced-motion`.
- Sample data note: scores are sample figures and poster URLs point at
  MyAnimeList's CDN. Replace them with your own data source when you
  wire up the real API.
