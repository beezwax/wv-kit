import { scriptNames } from './script-names.js';
import type { Product } from './types.js';

declare global {
  interface Window {
    FileMaker?: {
      PerformScript(name: string, param: string): void;
      PerformScriptWithOption(name: string, param: string, option: number): void;
    };
  }
}

const option = 0;
const queue: [string, string][] = [];

function dispatch(): void {
  queue.splice(0).forEach(([name, param]) => {
    window.FileMaker!.PerformScriptWithOption(name, param, option);
  });
  setTimeout(() => window.dispatchEvent(new Event('FilemakerLoaded')), 0);
}

if (Object.hasOwn(window, 'FileMaker')) {
  dispatch();
} else {
  let _fm: Window['FileMaker'];
  Object.defineProperty(window, 'FileMaker', {
    configurable: true,
    get() { return _fm; },
    set(val) { _fm = val; dispatch(); },
  });
}

function call(name: string, param = '{}'): void {
  if (window.FileMaker) {
    window.FileMaker.PerformScriptWithOption(name, param, option);
  } else {
    queue.push([name, param]);
  }
}

export default {
  requestProducts():             void { call(scriptNames.requestProducts); },
  requestProduct(id: string):    void { call(scriptNames.requestProduct,   JSON.stringify({ id })); },
  saveProduct(product: Product): void { call(scriptNames.saveProduct,      JSON.stringify(product)); },
  deleteProduct(id: string):     void { call(scriptNames.deleteProduct,    JSON.stringify({ id })); },
  navigateToDetail(id: string):  void { call(scriptNames.navigateToDetail, JSON.stringify({ id })); },
  navigateToList():              void { call(scriptNames.navigateToList); },
};
