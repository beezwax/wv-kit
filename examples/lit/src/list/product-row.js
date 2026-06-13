import { html } from 'lit';
import { fmScripts } from '../../fm/fm-scripts.js';
import { formatPrice, statusClass } from '../shared/product-utils.js';

// Returns a TemplateResult, not a custom element. <tbody> only accepts <tr>
// children per the HTML spec, so we inline the row into the parent template
// rather than wrapping it in a <product-row> tag.
export function renderProductRow(product) {
  return html`
    <tr style="cursor:pointer" @click=${() => fmScripts.navigateToDetail({ id: product.id })}>
      <td class="fw-medium">${product.name}</td>
      <td><code class="text-muted">${product.sku}</code></td>
      <td>${product.category}</td>
      <td class="text-end">${formatPrice(product.price)}</td>
      <td class="text-end">${product.stock}</td>
      <td><span class="badge bg-${statusClass(product.status)}">${product.status}</span></td>
    </tr>
  `;
}
