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
 * normally push back after running a script via
 * `PerformJavaScriptInWebViewer`.
 *
 * @param fn   Name of the global function to call on the browser side.
 * @param args Arguments passed through to that function.
 */
export function performJavaScriptInWebViewer(fn: string, ...args: unknown[]): void;

/**
 * Navigate the dev page to a new path or query. This mirrors a FileMaker
 * "Go To Layout" script step — a server-side action, NOT JavaScript pushed
 * to the viewer.
 *
 * - A value starting with `?` updates `window.location.search` only
 *   (preserves the current path; useful for query-driven viewers).
 * - Any other value sets `window.location.href` (full navigation).
 *
 * @param to Absolute path (e.g. `/list`, `/detail?id=42`) or query string
 *           (e.g. `?id=42`).
 */
export function goToLayout(to: string): void;

/**
 * Detail payload of the `wv-kit:schema-error` CustomEvent. Fires on the
 * window whenever an inbound or emitter-side schema validation fails — in
 * both dev (before the throw) and prod (before the log + pass-through).
 *
 * Use it to wire schema failures into your error tracker / toast / metrics:
 *
 *   window.addEventListener('wv-kit:schema-error', (e) => {
 *     const { label, issues, value } = e.detail;
 *     Sentry.captureMessage(`Schema fail: ${label}`, { extra: { issues, value } });
 *   });
 *
 * `label` is a string like `"jsFunctions.loadData"` or `"fmScripts.saveProduct"`
 * pinpointing where the failure happened.
 */
export interface SchemaErrorDetail {
  label:  string;
  issues: ReadonlyArray<{ readonly message: string }>;
  value:  unknown;
}

declare global {
  interface WindowEventMap {
    'wv-kit:schema-error': CustomEvent<SchemaErrorDetail>;
  }
}

// Minimal Standard Schema surface so wv-kit stays schema-library-agnostic
// (valibot, zod 4, arktype all implement this).
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly validate: (value: unknown) =>
      | { readonly value: Output; readonly issues?: undefined }
      | { readonly issues: ReadonlyArray<{ readonly message: string }> }
      | Promise<unknown>;
    readonly types?: { readonly input: Input; readonly output: Output };
  };
}

type SchemaInput<S>  = S extends StandardSchemaV1<infer I, any> ? I : never;
type SchemaOutput<S> = S extends StandardSchemaV1<any, infer O> ? O : never;

// A jsFunction entry is either a single Standard Schema (one-arg function)
// or an array of Standard Schemas (multi-arg, one schema per positional
// parameter). Arrays are detected at runtime via Array.isArray.
type JsFunctionDecl = StandardSchemaV1 | readonly StandardSchemaV1[];

type JsFunctionHandler<S> =
  S extends readonly StandardSchemaV1[]
    ? (...args: { [K in keyof S]: SchemaOutput<S[K]> }) => void
    : S extends StandardSchemaV1
      ? (value: SchemaOutput<S>) => void
      : never;

type JsFunctionEmitter<S> =
  S extends readonly StandardSchemaV1[]
    ? (...args: { [K in keyof S]: SchemaInput<S[K]> }) => void
    : S extends StandardSchemaV1
      ? (value: SchemaInput<S>) => void
      : never;

export interface FmScriptDef<Payload extends StandardSchemaV1 | undefined = StandardSchemaV1 | undefined> {
  fmName: string;
  payload?: Payload;
}

export interface ContractSpec<
  FmScripts extends Record<string, FmScriptDef> = Record<string, FmScriptDef>,
> {
  fmScripts: FmScripts;
}

export interface Contract<FmScripts extends Record<string, FmScriptDef>> {
  spec: ContractSpec<FmScripts>;
  /** Outbound (browser → FM) — typed FileMaker-script callers. */
  fmScripts: {
    [K in keyof FmScripts]: FmScripts[K]['payload'] extends StandardSchemaV1
      ? (input: SchemaInput<FmScripts[K]['payload']>) => void
      : () => void;
  };
}

/**
 * Declare the outbound (browser → FM) script surface for a project. FM
 * scripts share a single namespace per `.fmp12`, so this map is flat.
 *
 * Inbound (FM → browser) jsFunctions are declared per viewer with
 * `defineJsFunctions` — each viewer's `src/<viewer>/js-functions.js`.
 */
export function defineContract<
  const FmScripts extends Record<string, FmScriptDef>,
>(spec: ContractSpec<FmScripts>): Contract<FmScripts>;

type AnyHandler = (...args: any[]) => void;
type Handlers   = Record<string, AnyHandler>;

// Per-entry emitter type:
//   - tuple schema  → variadic (...args: SchemaInput[]) => void
//   - single schema → (value: SchemaInput<S>) => void
//   - no schema     → same shape as the handler (pass-through)
type EmitterFor<H, S> =
  S extends readonly StandardSchemaV1[]
    ? (...args: { [K in keyof S]: SchemaInput<S[K]> }) => void
  : S extends StandardSchemaV1
    ? (value: SchemaInput<S>) => void
  : H extends AnyHandler
    ? H
    : never;

/**
 * Map of validated emitters returned by `defineJsFunctions`. Used from
 * `fm/mocks.js` (delivers to the browser via SSE) or from browser-side
 * dev/UI code (dispatches locally to the registered handler).
 *
 *   jsFunctions.loadData(jsonStringOfProducts);
 */
export type JsFunctionsEmitters<
  H extends Handlers,
  S extends Partial<Record<keyof H, JsFunctionDecl>>,
> = {
  [K in keyof H]: EmitterFor<H[K], K extends keyof S ? S[K] : undefined>;
};

/**
 * Declare the inbound jsFunction surface for a single viewer. Handlers and
 * schemas are passed as separate maps so the handler bodies read as
 * ordinary functions and schemas are an optional side-table.
 *
 *   const handlers = {
 *     loadData(list)            { products.set(list); },
 *     showToast(level, message) { toast(level, message); },
 *   };
 *   const schemas = {
 *     loadData:  productListSchema,
 *     showToast: [v.picklist([...]), v.string()],
 *   };
 *   export const jsFunctions = defineJsFunctions(handlers, schemas);
 *
 * - Entries in `handlers` without a matching entry in `schemas` get a
 *   pass-through emitter (no validation).
 * - Tuple schemas (arrays of Standard Schemas) declare multi-arg
 *   jsFunctions; the handler is called with positional args, the emitter
 *   accepts them variadically.
 *
 * Each call carries its own handler-registry closure, so two viewers
 * declaring the same name with different schemas never collide.
 *
 * Side effects on import (browser only): registers each handler onto
 * `window.<name>` so FM's "Perform JavaScript in Web Viewer" delivers
 * through the validating emitter. On the server (mocks load this file
 * too), only the emitter map is returned — no window registration.
 */
export function defineJsFunctions<
  const H extends Handlers,
  const S extends Partial<Record<keyof H, JsFunctionDecl>> = {},
>(handlers: H, schemas?: S): JsFunctionsEmitters<H, S>;


/**
 * Dev-server-side mock for a contract. Each handler receives the parsed +
 * validated fmScript payload. To push jsFunctions back to the browser,
 * import the relevant viewer's `jsFunctions` from its
 * `src/<viewer>/js-functions.js` and call `jsFunctions.<name>(value)` —
 * each viewer has its own emitter validated against its own schema. For
 * navigation, import `goToLayout` from 'wv-kit'. Returns the
 * fmScript-name → handler map wv-kit's dev server consumes (use as the
 * default export of `fm/mocks.js`).
 *
 *   navigateToList() {
 *     goToLayout('/list');
 *     listJsFns.loadData(JSON.stringify(readAll()));
 *   }
 *
 * For ad-hoc calls outside the contract (e.g. `window.alert`), import
 * `performJavaScriptInWebViewer` from 'wv-kit' directly.
 */
export function defineMock<
  FmScripts extends Record<string, FmScriptDef>,
>(
  contract: Contract<FmScripts>,
  handlers: {
    [K in keyof FmScripts]: FmScripts[K]['payload'] extends StandardSchemaV1
      ? (payload: SchemaOutput<FmScripts[K]['payload']>) => void
      : (payload: undefined) => void;
  },
): Record<string, (paramStr: string) => void>;
