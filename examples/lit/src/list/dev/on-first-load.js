// fetch instead of `import data from './data.json'` — Vite caches the static
// JSON import, which goes stale the moment fm/mocks.js writes to the
// file. Fetching at runtime gets a fresh read every page load.
import { jsFunctions } from '../js-functions.js';

// loadData's wire schema expects a JSON string; fetch as text and pass through.
const data = await fetch(new URL('./data.json', import.meta.url)).then(r => r.text());
jsFunctions.loadData(data);
