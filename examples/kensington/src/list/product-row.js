import { t } from 'kensington';
import { fmScripts } from '../../fm/fm-scripts.js';
import { formatPrice, statusClass } from '../shared/product-utils.js';

export function productRow(p) {
  return t.tr({
    dataKey: p.id,
    style: { cursor: 'pointer' },
    onclick() { fmScripts.navigateToDetail({ id: p.id }); },
  }, [
    t.td({ class: 'fw-medium' }, p.name),
    t.td(t.code({ class: 'text-muted' }, p.sku)),
    t.td(p.category),
    t.td({ class: 'text-end' }, formatPrice(p.price)),
    t.td({ class: 'text-end' }, String(p.stock)),
    t.td(t.span({ class: `badge bg-${statusClass(p.status)}` }, p.status)),
  ]);
}
