// Dev-only: trigger the same FM script the production layout's OnLayoutEnter
// trigger would run. The mock does goToLayout + push loadData; goToLayout to
// the current URL is a no-op, so reload Just Works™.
import filemakerScripts from '../../shared/filemaker-scripts.js';

filemakerScripts.navigateToList();
