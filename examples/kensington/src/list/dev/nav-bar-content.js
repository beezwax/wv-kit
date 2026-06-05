import data from './data.json' with { type: 'json' };
import { t } from '../../shared/installed/kensington.js';

export default t.button({
  type: 'button',
  class: 'btn btn-sm btn-outline-secondary',
  onclick() { window.loadData(JSON.stringify(data)); },
}, 'Reload').toElement();
