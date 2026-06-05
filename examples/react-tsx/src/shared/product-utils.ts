import currency from 'currency.js';
import type { Product } from './types.js';

export function formatPrice(price: number): string {
  return currency(price).format();
}

export function statusClass(status: Product['status']): string {
  return status === 'active' ? 'success' : 'secondary';
}
