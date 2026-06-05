import filemakerScripts from '../shared/filemaker-scripts.js';
import { setProduct, setSaveResult } from './view.js';

export default {
  loadDetail(jsonStr) {
    setProduct(JSON.parse(jsonStr));
  },
  onSaveResult(jsonStr) {
    const result = JSON.parse(jsonStr);
    if (result.product) setProduct(result.product);
    setSaveResult(result);
  },
  onDeleteResult(jsonStr) {
    const { success } = JSON.parse(jsonStr);
    if (success) filemakerScripts.navigateToList();
  },
};
