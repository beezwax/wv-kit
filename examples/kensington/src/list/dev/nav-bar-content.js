import { t } from '../../shared/installed/kensington.js';

export default t.button({
  type: 'button',
  class: 'btn btn-sm btn-outline-secondary',
  onclick() {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => window.loadData(JSON.stringify(data)));
  },
}, 'Reload').toElement();
