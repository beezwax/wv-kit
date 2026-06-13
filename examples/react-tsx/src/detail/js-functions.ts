import { defineJsFunctions } from 'wv-kit';
import { fmScripts } from '../../fm/fm-scripts.js';
import { deleteResultSchema, productSchema, saveResultSchema } from '../../fm/schema.js';
import { updateProduct, updateSaveResult } from './view.js';
import type { DeleteResult, Product, SaveResult } from '../../fm/schema.js';

const handlers = {
  loadDetail(product: Product) { updateProduct(product); },

  onSaveResult(result: SaveResult) {
    if (result.product) updateProduct(result.product);
    updateSaveResult(result);
  },

  onDeleteResult(result: DeleteResult) {
    if (result.success) fmScripts.navigateToList();
  },
};

const schemas = {
  loadDetail:     productSchema,
  onSaveResult:   saveResultSchema,
  onDeleteResult: deleteResultSchema,
};

export const jsFunctions: {
  loadDetail(json: string):     void;
  onSaveResult(json: string):   void;
  onDeleteResult(json: string): void;
} = defineJsFunctions(handlers, schemas);
