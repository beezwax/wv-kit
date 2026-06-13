import * as v from 'valibot';

// Inner shapes — what your code consumes after parsing. Use these for
// fmScripts payloads (wv-kit JSON.stringifies for the wire) and anywhere
// you construct/inspect a typed value.
export const productShape = v.object({
  id:          v.string(),
  name:        v.string(),
  sku:         v.string(),
  category:    v.string(),
  price:       v.number(),
  stock:       v.number(),
  status:      v.picklist(['active', 'discontinued']),
  description: v.string(),
  updatedAt:   v.string(),
});

export const productListShape = v.array(productShape);

export const idParamShape = v.object({ id: v.string() });

export const saveResultShape = v.object({
  success: v.boolean(),
  product: v.optional(productShape),
  error:   v.optional(v.string()),
});

export const deleteResultShape = v.object({
  success: v.boolean(),
  id:      v.optional(v.string()),
  error:   v.optional(v.string()),
});

// Wire schemas — what crosses the FM ↔ browser seam. FileMaker carries
// only text, so anything richer than a raw string is a JSON-stringified
// payload. Each wire schema is a pipe: string → JSON.parse → validate.
const jsonOf = <S extends v.GenericSchema>(shape: S) =>
  v.pipe(v.string(), v.transform(JSON.parse), shape);

export const productSchema      = jsonOf(productShape);
export const productListSchema  = jsonOf(productListShape);
export const idParamSchema      = jsonOf(idParamShape);
export const saveResultSchema   = jsonOf(saveResultShape);
export const deleteResultSchema = jsonOf(deleteResultShape);

// Inferred types — what handlers receive after the wire schema parses.
export type Product      = v.InferOutput<typeof productShape>;
export type ProductList  = v.InferOutput<typeof productListShape>;
export type IdParam      = v.InferOutput<typeof idParamShape>;
export type SaveResult   = v.InferOutput<typeof saveResultShape>;
export type DeleteResult = v.InferOutput<typeof deleteResultShape>;

export const blankProduct: Product = {
  id:          'new',
  name:        '',
  sku:         '',
  category:    '',
  price:       0,
  stock:       0,
  status:      'active',
  description: '',
  updatedAt:   '',
};
