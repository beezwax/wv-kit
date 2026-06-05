# wv-kit Example — React + TypeScript

A two-viewer product catalog using React with TSX and TypeScript.

## Setup

```bash
npm install
npm start
```

Open http://localhost:3000

Type-check without building:
```bash
npm run typecheck
```

## What this demonstrates

- `.tsx` files transformed by the dev server's esbuild middleware
- React hooks (`useState`, `useEffect`, `useCallback`)
- TypeScript interfaces for FM callback data
- `queueMicrotask` to render React after the container is appended
- FM callbacks wired through a module-level setter
