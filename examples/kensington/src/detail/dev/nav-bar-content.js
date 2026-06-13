import data from '../../list/dev/data.json';
import { t } from 'kensington';
import { jsFunctions } from '../js-functions.js';
import { blankProduct } from '../../../fm/schema.js';

export default t.div({ class: 'd-flex align-items-center gap-2' }, [
  t.label({ class: 'form-label mb-0 small fw-medium' }, 'Load:'),
  t.select({
    class: 'form-select form-select-sm w-auto',
    onchange(e) {
      const id = e.target.value;
      if (!id) return;
      // loadDetail's wire schema expects a JSON string (FM only carries
      // text across the WebViewer), so stringify before pushing.
      if (id === 'new') {
        jsFunctions.loadDetail(JSON.stringify(blankProduct));
      } else {
        const product = data.find(p => p.id === id);
        if (product) jsFunctions.loadDetail(JSON.stringify(product));
      }
      e.target.value = '';
    },
  }, [
    t.option({ value: '' }, 'Pick a product…'),
    t.option({ value: 'new' }, '＋ New product'),
    ...data.map(p => t.option({ value: p.id }, p.name)),
  ]),
]).toElement();
