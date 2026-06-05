import currency from './installed/currency.js';

export function formatPrice(price) {
  return currency(price).format();
}

export function statusClass(status) {
  return status === 'active' ? 'success' : 'secondary';
}
