import { computed, signal, t } from '../shared/installed/kensington.js';
import filemakerScripts from '../shared/filemaker-scripts.js';
import { formatPrice, statusClass } from '../shared/product-utils.js';

export const products = signal([]);
const query    = signal('');
const category = signal('');

export function resetFilters() {
  query.set('');
  category.set('');
}

const categories = computed(() =>
  [...new Set(products.get().map(p => p.category))].sort(),
);

const filtered = computed(() => {
  const q = query.get().toLowerCase();
  const cat = category.get();
  return products.get().filter(p =>
    (!cat || p.category === cat) &&
    (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
  );
});

function productRow(p) {
  return t.tr({
    dataKey: p.id,
    style: { cursor: 'pointer' },
    onclick() { filemakerScripts.navigateToDetail(p.id); },
  }, [
    t.td({ class: 'fw-medium' }, p.name),
    t.td(t.code({ class: 'text-muted' }, p.sku)),
    t.td(p.category),
    t.td({ class: 'text-end' }, formatPrice(p.price)),
    t.td({ class: 'text-end' }, String(p.stock)),
    t.td(t.span({ class: `badge bg-${statusClass(p.status)}` }, p.status)),
  ]);
}

export default function buildApp() {
  return t.div({ class: 'container py-3' }, [
    t.div({ class: 'd-flex align-items-center gap-3 mb-3 flex-wrap' }, [
      t.h1({ class: 'fs-4 mb-0' }, 'Product Catalog'),
      t.span({ class: 'text-muted small' }, [
        computed(() => `${filtered.get().length} product${filtered.get().length !== 1 ? 's' : ''}`)
      ]),
      t.input({
        class: 'form-control w-auto',
        placeholder: 'Search name or SKU…',
        type: 'search',
        prop: { value: query },
        oninput(evt) { query.set(evt.target.value); },
      }),
      t.select({
        class: 'form-select w-auto',
        prop: { value: category },
        onchange(evt) { category.set(evt.target.value); },
      }, [
        t.option({ value: '' }, 'All Categories'),
        computed(() => categories.get().map(cat =>
          t.option({ value: cat }, cat),
        )),
      ]),
      t.button({
        class: 'btn btn-primary ms-auto',
        type: 'button',
        onclick() { filemakerScripts.navigateToDetail('new'); },
      }, '+ New Product'),
    ]),
    t.div({ class: 'table-responsive' }, t.table({ class: 'table table-hover align-middle mb-0' }, [
        t.thead({ class: 'table-light' }, t.tr([
            t.th('Name'),
            t.th('SKU'),
            t.th('Category'),
            t.th({ class: 'text-end' }, 'Price'),
            t.th({ class: 'text-end' }, 'Stock'),
            t.th('Status'),
          ]),),
        t.tbody(computed(() => {
            const rows = filtered.get();
            if (rows.length === 0) {
              return t.tr(t.td({ colspan: 6, class: 'text-center text-muted py-4' }, 'No products found'));
            }
            return rows.map(productRow);
          }),),
      ]),),
  ]).toElement();
}
