import data from './data.json';
import { t } from 'kensington';

export default t.button({
  type: 'button',
  class: 'btn btn-sm btn-outline-secondary',
  onclick() { window.loadData(JSON.stringify(data)); },
}, 'Reload').toElement();
