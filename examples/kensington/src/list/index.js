import controlFunctions from './control-functions.js';
import buildApp from './view.js';

// Production: FileMaker pushes data via the layout's OnLayoutEnter trigger.
// Dev: src/list/dev/client.js plays that role by firing the same FM script.
// The viewer's index.js itself doesn't request data.
Object.assign(window, controlFunctions);
export default buildApp();
