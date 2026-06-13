// Side-effect import — registers FileMaker → browser handlers onto window.*
// (one per entry in ./js-functions.js).
import './js-functions.js';
import buildApp from './view.js';

export default buildApp();
