import { LitElement, html } from 'lit';
import filemakerScripts from '../shared/filemaker-scripts.js';
import { formatPrice, statusClass } from '../shared/product-utils.js';

class ProductRow extends LitElement {
  static properties = {
    product: {},
  };

  createRenderRoot() { return this; }

  constructor() {
    super();
    this.product = {};
  }

  render() {
    const p = this.product;
    return html`
      <tr style="cursor:pointer" @click=${() => filemakerScripts.navigateToDetail(p.id)}>
        <td class="fw-medium">${p.name}</td>
        <td><code class="text-muted">${p.sku}</code></td>
        <td>${p.category}</td>
        <td class="text-end">${formatPrice(p.price)}</td>
        <td class="text-end">${p.stock}</td>
        <td><span class="badge bg-${statusClass(p.status)}">${p.status}</span></td>
      </tr>
    `;
  }
}

customElements.define('product-row', ProductRow);

export function renderProductRow(product) {
  const el = document.createElement('product-row');
  el.product = product;
  return el;
}
