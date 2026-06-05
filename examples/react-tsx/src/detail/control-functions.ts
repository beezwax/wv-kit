import filemakerScripts from '../shared/filemaker-scripts.js';
import type { DeleteResult, Product, SaveResult } from '../shared/types.js';
import { updateProduct, updateSaveResult } from './view.js';

export default {
  loadDetail(jsonStr: string) {
    updateProduct(JSON.parse(jsonStr) as Product);
  },
  onSaveResult(jsonStr: string) {
    const result = JSON.parse(jsonStr) as SaveResult;
    if (result.product) updateProduct(result.product);
    updateSaveResult(result);
  },
  onDeleteResult(jsonStr: string) {
    const { success } = JSON.parse(jsonStr) as DeleteResult;
    if (success) filemakerScripts.navigateToList();
  },
};
