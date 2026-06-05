import { scriptNames } from './script-names.js';

const option = 0;
const queue = [];

function dispatch() {
  queue.splice(0).forEach(([name, param]) => {
    window.FileMaker.PerformScriptWithOption(name, param, option);
  });
  setTimeout(() => window.dispatchEvent(new Event('FilemakerLoaded')), 0);
}

if (Object.hasOwn(window, 'FileMaker')) {
  dispatch();
} else {
  let _fm;
  Object.defineProperty(window, 'FileMaker', {
    configurable: true,
    get() { return _fm; },
    set(val) { _fm = val; dispatch(); },
  });
}

function call(name, param = '{}') {
  if (window.FileMaker) {
    window.FileMaker.PerformScriptWithOption(name, param, option);
  } else {
    queue.push([name, param]);
  }
}

export default {
  requestProducts()      { call(scriptNames.requestProducts); },
  requestProduct(id)     { call(scriptNames.requestProduct,   JSON.stringify({ id })); },
  saveProduct(product)   { call(scriptNames.saveProduct,      JSON.stringify(product)); },
  deleteProduct(id)      { call(scriptNames.deleteProduct,    JSON.stringify({ id })); },
  navigateToDetail(id)   { call(scriptNames.navigateToDetail, JSON.stringify({ id })); },
  navigateToList()       { call(scriptNames.navigateToList); },
};
