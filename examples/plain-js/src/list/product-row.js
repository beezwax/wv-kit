import { formatPrice, statusClass } from '../shared/product-utils.js';

export function createProductRow(product, onClick) {
  const tr = document.createElement('tr');
  tr.style.cursor = 'pointer';
  tr.innerHTML = `
    <td class="fw-medium">${product.name}</td>
    <td><code class="text-muted">${product.sku}</code></td>
    <td>${product.category}</td>
    <td class="text-end">${formatPrice(product.price)}</td>
    <td class="text-end">${product.stock}</td>
    <td><span class="badge bg-${statusClass(product.status)}">${product.status}</span></td>
  `;
  tr.addEventListener('click', onClick);
  return tr;
}
