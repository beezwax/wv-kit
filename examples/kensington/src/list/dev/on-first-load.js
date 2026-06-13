// fetch instead of `import data from './data.json'` — Vite caches the static
// JSON import, which goes stale the moment fm/mocks.js writes to the
// file. Fetching at runtime gets a fresh read every page load.
import { jsFunctions } from '../js-functions.js';

// loadData's wire schema is `v.pipe(v.string(), v.transform(JSON.parse), …)`,
// so the emitter expects the wire string. Fetch as text and pass through
// directly — no parse + restringify round-trip.
const data = await fetch(new URL('./data.json', import.meta.url)).then(r => r.text());
jsFunctions.loadData(data);
