// Validate inbound script payloads against the contract. The emitters used
// to push callbacks back to the browser live on `contract.callbacks` and are
// set up by `defineContract` — see lib/browser/contract.js.

function validate(label, schema, value) {
  if (!schema) return value;
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise) {
    throw new Error(`[wv-kit/contract/mock] async schemas are not supported (${label})`);
  }
  if (result.issues) {
    throw new Error(`[wv-kit/contract/mock] ${label} validation failed: ` + JSON.stringify(result.issues, null, 2));
  }
  return result.value;
}

export function defineMock(contract, handlers) {
  const { fmScripts } = contract.spec;
  const result = {};
  for (const [key, def] of Object.entries(fmScripts)) {
    const handler = handlers[key];
    if (!handler) {
      console.warn(`[wv-kit/contract/mock] no handler for fmScript "${key}"`);
      continue;
    }
    result[def.fmName] = (paramStr) => {
      if (!def.payload) return handler(undefined);
      const raw = paramStr ? JSON.parse(paramStr) : undefined;
      return handler(validate(`mock.fmScripts.${key}`, def.payload, raw));
    };
  }
  return result;
}
