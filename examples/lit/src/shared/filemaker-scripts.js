import { performFileMakerScript } from 'wv-kit';
import { scriptNames } from './script-names.js';

export default {
  requestProducts()    { performFileMakerScript(scriptNames.requestProducts); },
  requestProduct(id)   { performFileMakerScript(scriptNames.requestProduct, { id }); },
  saveProduct(product) { performFileMakerScript(scriptNames.saveProduct, product); },
  deleteProduct(id)    { performFileMakerScript(scriptNames.deleteProduct, { id }); },
  navigateToDetail(id) { performFileMakerScript(scriptNames.navigateToDetail, { id }); },
  navigateToList()     { performFileMakerScript(scriptNames.navigateToList); },
};
