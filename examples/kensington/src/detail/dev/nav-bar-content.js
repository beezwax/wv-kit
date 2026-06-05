import data from '../../list/dev/data.json';
import { t } from 'kensington';
import blankProduct from './blank-product.js';

export default t.div({ class: 'd-flex align-items-center gap-2' }, [
  t.label({ class: 'form-label mb-0 small fw-medium' }, 'Load:'),
  t.select({
    class: 'form-select form-select-sm w-auto',
    onchange(e) {
      const id = e.target.value;
      if (!id) return;
      if (id === 'new') {
        window.loadDetail(JSON.stringify(blankProduct));
      } else {
        const product = data.find(p => p.id === id);
        if (product) window.loadDetail(JSON.stringify(product));
      }
      e.target.value = '';
    },
  }, [
    t.option({ value: '' }, 'Pick a product…'),
    t.option({ value: 'new' }, '＋ New product'),
    ...data.map(p => t.option({ value: p.id }, p.name)),
  ]),
]).toElement();
