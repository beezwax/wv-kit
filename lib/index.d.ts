/**
 * Register a callback to run after the viewer's app element is mounted into
 * the DOM. Callbacks fire when wv-kit's injected script calls flushMounts()
 * after appending the app element to #app.
 *
 * Use this when initialization requires the element to be in the document —
 * for example, instantiating Bootstrap modals, measuring layout, or
 * registering a Svelte/Solid component via mount()/render().
 */
export function onMount(fn: () => void): void;

/**
 * Run all queued onMount callbacks in registration order, then empty the
 * queue. Called by wv-kit's injected inline script after the app element
 * is appended to #app; rarely called by user code.
 */
export function flushMounts(): void;

/**
 * Call a FileMaker script via window.FileMaker.PerformScriptWithOption.
 * If FileMaker isn't available yet (e.g. browser scripts loaded before the
 * host injected its API), the call is queued and dispatched once
 * window.FileMaker becomes defined.
 *
 * @param name    The FileMaker script name as configured in the host file.
 * @param payload Optional payload — passed as the second argument to the
 *                FileMaker script after JSON.stringify. When omitted, the
 *                empty object `{}` is sent.
 */
export function performFileMakerScript(name: string, payload?: unknown): void;

/**
 * Send a FileMaker → browser callback. The dev server forwards this over
 * SSE; the browser's shared-dev-index.js receives it and invokes
 * `window[fn](...args)` — typically a control function like `loadData`.
 *
 * Used inside `dev-server/mocks.js` to simulate what FileMaker would
 * normally push back after running a script.
 *
 * @param fn   Name of the global function to call on the browser side.
 * @param args Arguments passed through to that function.
 */
export function performJavaScriptInWebViewer(fn: string, ...args: unknown[]): void;
