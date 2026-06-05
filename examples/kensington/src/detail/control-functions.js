import filemakerScripts from '../shared/filemaker-scripts.js';
import { loadProduct, showSaveResult } from './view.js';

export default {
  loadDetail(jsonStr) {
    loadProduct(JSON.parse(jsonStr));
  },
  onSaveResult(jsonStr) {
    const result = JSON.parse(jsonStr);
    if (result.product) loadProduct(result.product);
    showSaveResult(result);
  },
  onDeleteResult(jsonStr) {
    const { success } = JSON.parse(jsonStr);
    if (success) filemakerScripts.navigateToList();
  },
};
