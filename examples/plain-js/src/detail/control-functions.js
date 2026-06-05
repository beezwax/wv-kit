import filemakerScripts from '../shared/filemaker-scripts.js';
import { renderProduct, showSaveResult } from './view.js';

export default {
  loadDetail(jsonStr) {
    renderProduct(JSON.parse(jsonStr));
  },
  onSaveResult(jsonStr) {
    const result = JSON.parse(jsonStr);
    if (result.product) renderProduct(result.product);
    showSaveResult(result);
  },
  onDeleteResult(jsonStr) {
    const { success } = JSON.parse(jsonStr);
    if (success) filemakerScripts.navigateToList();
  },
};
