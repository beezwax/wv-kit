import { performFileMakerScript } from 'wv-kit';
import { scriptNames } from './script-names.js';
import type { Product } from './types.js';

export default {
  navigateToList():              void { performFileMakerScript(scriptNames.navigateToList); },
  navigateToDetail(id: string):  void { performFileMakerScript(scriptNames.navigateToDetail, { id }); },
  saveProduct(product: Product): void { performFileMakerScript(scriptNames.saveProduct, product); },
  deleteProduct(id: string):     void { performFileMakerScript(scriptNames.deleteProduct, { id }); },
};
