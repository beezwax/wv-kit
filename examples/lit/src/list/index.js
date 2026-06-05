import filemakerScripts from '../shared/filemaker-scripts.js';
import controlFunctions from './control-functions.js';
import buildApp from './view.js';

Object.assign(window, controlFunctions);
filemakerScripts.requestProducts();
export default buildApp();
