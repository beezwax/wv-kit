import { setProduct, showSaveResult } from './state.svelte.js';
import filemakerScripts from '../shared/filemaker-scripts.js';

export default {
  loadDetail(jsonStr) {
    setProduct(JSON.parse(jsonStr));
  },
  onSaveResult(jsonStr) {
    const result = JSON.parse(jsonStr);
    if (result.product) setProduct(result.product);
    showSaveResult(result);
  },
  onDeleteResult(jsonStr) {
    const { success } = JSON.parse(jsonStr);
    if (success) filemakerScripts.navigateToList();
  },
};
