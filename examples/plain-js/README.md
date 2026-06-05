# wv-kit Example — Plain HTML/JS

A two-viewer product catalog using plain DOM APIs and vanilla JavaScript.

## Setup

```bash
npm install
npm start
```

Open http://localhost:3000 — the dev server auto-redirects to `/list`.

## Viewers

- `/list` — product table with search and category filter
- `/detail?id=<id>` — product form with save and delete

## What this demonstrates

- `front-end-dependencies/` — `currency.js` bundled for browser use
- FileMaker script calls via `src/shared/filemaker-scripts.js`
- Inbound FM callbacks: `loadData`, `loadDetail`, `onSaveResult`, `onDeleteResult`
- Dev mocks that read/write `dev-server/data/products.json`
- Dev route: `GET /api/products` (inspect data in browser or curl)
- `nav-bar-content.js` in each viewer (visible in the dev nav modal)
- Shared utilities in `src/shared/product-utils.js`
