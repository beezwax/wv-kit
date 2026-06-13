// Shared validation helpers used by both `defineContract` (fmScripts) and
// `defineJsFunctions` (mount + jsFunctions emitters).

// Validates against a Standard Schema (valibot / zod 4 / arktype / …).
// Dev: throws on failure (the seam screams immediately).
// Prod: logs and passes the raw value through (the viewer keeps running;
// you still get a console signal to chase in real FM testing).
//
// Validation failures also dispatch a `wv-kit:schema-error` CustomEvent on
// the window, so apps can hook into it for error tracking / UI toasts /
// telemetry without touching wv-kit internals:
//
//   window.addEventListener('wv-kit:schema-error', (e) => {
//     const { label, issues, value } = e.detail;
//     Sentry.captureMessage(`Schema validation failed: ${label}`, { extra: { issues, value } });
//   });
//
// The event fires in both dev and prod, before the throw / log-and-return.
export function validate(label, schema, value) {
  if (!schema) return value;
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise) {
    throw new Error(`[wv-kit/contract] async schemas are not supported (${label})`);
  }
  if (result.issues) {
    notifySchemaError(label, result.issues, value);
    if (import.meta.env.DEV) {
      throw new Error(`[wv-kit/contract] ${label} validation failed: ` + JSON.stringify(result.issues, null, 2));
    }
    console.error(`[wv-kit/contract] ${label} validation failed`, { issues: result.issues, value });
    return value;
  }
  return result.value;
}

function notifySchemaError(label, issues, value) {
  if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('wv-kit:schema-error', {
    detail: { label, issues, value },
  }));
}

// Strict validate for emitter paths. The mock-server side always wants loud
// failures, and the in-browser local-dispatch path benefits from the same
// strictness since the caller is local code, not external FM data.
// Also fires `wv-kit:schema-error` on the window (browser only) before
// throwing — same hook as `validate`.
export function validateStrict(label, schema, value) {
  if (!schema) return value;
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise) {
    throw new Error(`[wv-kit/contract] async schemas are not supported (${label})`);
  }
  if (result.issues) {
    notifySchemaError(label, result.issues, value);
    throw new Error(`[wv-kit/contract] ${label} validation failed: ` + JSON.stringify(result.issues, null, 2));
  }
  return result.value;
}

// Wrap an array-of-schemas as a Standard Schema. Result validates an
// Array-of-length-N, where the N-th element is parsed by the N-th sub-schema.
export function tupleWrapper(schemas) {
  return {
    '~standard': {
      version: 1,
      vendor: 'wv-kit',
      validate(value) {
        if (!Array.isArray(value)) {
          return { issues: [{ message: `Expected ${schemas.length} positional args, got ${typeof value}` }] };
        }
        if (value.length !== schemas.length) {
          return { issues: [{ message: `Expected ${schemas.length} positional args, got ${value.length}` }] };
        }
        const out = new Array(schemas.length);
        for (let i = 0; i < schemas.length; i++) {
          const r = schemas[i]['~standard'].validate(value[i]);
          if (r instanceof Promise) {
            return { issues: [{ message: `Async schemas not supported (arg ${i})` }] };
          }
          if (r.issues) {
            return { issues: r.issues.map(issue => ({ ...issue, message: `[arg ${i}] ${issue.message}` })) };
          }
          out[i] = r.value;
        }
        return { value: out };
      },
    },
  };
}
