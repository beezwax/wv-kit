import { computed, signal, t } from 'kensington';
import { fmScripts } from '../../fm/fm-scripts.js';
import { formatPrice } from '../shared/product-utils.js';
import { saveToast } from './save-toast.js';

export const product  = signal(null);
const saving  = signal(false);
const toast   = signal(null); // { message, type }

// Editable field signals
const name        = signal('');
const sku         = signal('');
const category    = signal('');
const price       = signal(0);
const stock       = signal(0);
const status      = signal('active');
const description = signal('');

/** @param {import('../../fm/schema.js').Product} p */
export function loadProduct(p) {
  product.set(p);
  name.set(p.name);
  sku.set(p.sku);
  category.set(p.category);
  price.set(p.price);
  stock.set(p.stock);
  status.set(p.status);
  description.set(p.description);
}

/** @param {import('../../fm/schema.js').SaveResult} result */
export function showSaveResult(result) {
  saving.set(false);
  toast.set({
    message: result.success ? '✓ Saved' : `Error: ${result.error}`,
    type: result.success ? 'success' : 'danger'
  });
  setTimeout(() => toast.set(null), 3000);
}

function field(label, input) {
  return t.div({ class: 'mb-3' }, [
    t.label({ class: 'form-label fw-medium' }, label),
    input,
  ]);
}

export default function buildApp() {
  // Transforms must live at this scope — never inside a reactive callback
  const formattedPrice = price.transform(v => formatPrice(v));
  const saveBtnClass   = saving.transform(s => `btn btn-primary${s ? ' disabled' : ''}`);
  const saveBtnLabel   = saving.transform(s => s ? 'Saving…' : 'Save');
  const isNew          = product.transform(p => p?.id === 'new');
  const title          = computed(() => product.get()?.id === 'new' ? 'New Product' : name.get());
  const updatedLabel   = computed(() => {
    return product.get()?.id === 'new' ? '' : product.get() ? `Updated: ${product.get().updatedAt}` : ''
  });

  const view = t.div({ class: 'container py-3' }, [
    t.div({ class: 'd-flex align-items-center gap-3 mb-4' }, [
      t.button({
        class: 'btn btn-outline-secondary',
        type: 'button',
        onclick() { fmScripts.navigateToList(); },
      }, '← List'),
      t.h1({ class: 'fs-4 mb-0 flex-grow-1' }, title),
      t.span({ class: 'text-muted small' }, updatedLabel),
    ]),

    // Loading state — disappears once product is set
    product.transform(p => p ? null : t.p({ class: 'text-muted' }, 'Loading product…')),

    // Form — always in DOM, hidden until product loads
    t.div({ prop: { hidden: product.transform(p => !p) } }, [
      t.div({ class: 'row g-3' }, [
        t.div({ class: 'col-md-6' }, [
          field('Name', [
            t.input({
              class: 'form-control',
              type: 'text',
              prop: { value: name },
              oninput(e) { name.set(e.target.value); }
            }),
          ]),
        ]),
        t.div({ class: 'col-md-6' }, [
          field('SKU', [
            t.input({
              class: 'form-control',
              type: 'text',
              prop: { value: sku },
              oninput(e) { sku.set(e.target.value); },
            }),
          ]),
        ]),
        t.div({ class: 'col-md-4' }, [
          field('Category', [
            t.input({
              class: 'form-control',
              type: 'text',
              prop: { value: category },
              oninput(e) { category.set(e.target.value); },
            }),
          ]),
        ]),
        t.div({ class: 'col-md-4' }, [
          field('Price', [
            t.input({
              class: 'form-control',
              type: 'number',
              step: '0.01',
              min: '0',
              prop: { value: price },
              oninput(e) { price.set(parseFloat(e.target.value) || 0); },
            }),
          ]),
        ]),
        t.div({ class: 'col-md-4' }, [
          t.div({ class: 'mb-3' }, [
            t.label({ class: 'form-label fw-medium d-block' }, 'Formatted'),
            t.span({ class: 'form-control-plaintext fw-bold text-success fs-5' }, formattedPrice),
          ]),
        ]),
        t.div({ class: 'col-md-3' }, [
          field('Stock', [
            t.input({
              class: 'form-control',
              type: 'number',
              min: '0',
              prop: { value: stock },
              oninput(e) { stock.set(parseInt(e.target.value, 10) || 0); },
            }),
          ]),
        ]),
        t.div({ class: 'col-md-3' }, [
          field('Status', [
            t.select({
              class: 'form-select',
              prop: { value: status },
              onchange(e) { status.set(e.target.value); }
            }, [
              t.option({ value: 'active' }, 'Active'),
              t.option({ value: 'discontinued' }, 'Discontinued'),
            ]),
          ]),
        ]),
        t.div({ class: 'col-12' }, [
          field('Description', [
            t.textarea({
              class: 'form-control',
              rows: 3,
              prop: { value: description },
              oninput(e) { description.set(e.target.value); },
            }),
          ]),
        ]),
      ]),

      t.div({ class: 'd-flex gap-2 mt-4 pt-3 border-top' }, [
        t.button({
          class: saveBtnClass,
          type: 'button',
          onclick() {
            if (!product.get()) return;
            saving.set(true);
            fmScripts.saveProduct({
              ...product.get(),
              name: name.get(),
              sku: sku.get(),
              category: category.get(),
              price: price.get(),
              stock: stock.get(),
              status: status.get(),
              description: description.get(),
            });
          },
        }, saveBtnLabel),

        t.button({
          class: 'btn btn-outline-danger ms-auto',
          type: 'button',
          prop: { hidden: isNew },
          onclick() {
            const p = product.get();
            if (p && confirm(`Delete "${p.name}"? This cannot be undone.`)) {
              fmScripts.deleteProduct({ id: p.id });
            }
          },
        }, 'Delete'),
      ]),
    ]),

    // Toast notification
    saveToast(toast),
  ]);

  return view.toElement();
}
