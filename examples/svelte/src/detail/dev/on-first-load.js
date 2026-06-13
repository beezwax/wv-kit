// Dev-only: trigger the same FM script that "+ New Product" / a list-row
// click would run. The mock does goToLayout + push loadDetail; goToLayout to
// the current URL is a no-op, so reload Just Works™.
import { fmScripts } from '../../../fm/fm-scripts.js';

const id = new URLSearchParams(window.location.search).get('id') ?? 'new';
fmScripts.navigateToDetail({ id });
