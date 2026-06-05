import { performFileMakerScript } from 'wv-kit';
import { scriptNames } from './script-names.js';
import type { Product } from './types.js';

export default {
  requestProducts():             void { performFileMakerScript(scriptNames.requestProducts); },
  requestProduct(id: string):    void { performFileMakerScript(scriptNames.requestProduct, { id }); },
  saveProduct(product: Product): void { performFileMakerScript(scriptNames.saveProduct, product); },
  deleteProduct(id: string):     void { performFileMakerScript(scriptNames.deleteProduct, { id }); },
  navigateToDetail(id: string):  void { performFileMakerScript(scriptNames.navigateToDetail, { id }); },
  navigateToList():              void { performFileMakerScript(scriptNames.navigateToList); },
};
