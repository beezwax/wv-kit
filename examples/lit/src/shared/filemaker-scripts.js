import { performFileMakerScript } from 'wv-kit';
import { scriptNames } from './script-names.js';

export default {
  navigateToList()     { performFileMakerScript(scriptNames.navigateToList); },
  navigateToDetail(id) { performFileMakerScript(scriptNames.navigateToDetail, { id }); },
  saveProduct(product) { performFileMakerScript(scriptNames.saveProduct, product); },
  deleteProduct(id)    { performFileMakerScript(scriptNames.deleteProduct, { id }); },
};
