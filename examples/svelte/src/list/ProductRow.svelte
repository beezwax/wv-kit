<script>
  import filemakerScripts from '../shared/filemaker-scripts.js';
  import { formatPrice, statusClass } from '../shared/product-utils.js';

  let { product } = $props();
</script>

<tr
  style="cursor: pointer"
  onclick={() => filemakerScripts.navigateToDetail(product.id)}
>
  <td class="fw-medium">{product.name}</td>
  <td><code class="text-muted">{product.sku}</code></td>
  <td>{product.category}</td>
  <td class="text-end">{formatPrice(product.price)}</td>
  <td class="text-end">{product.stock}</td>
  <td>
    <span class="badge bg-{statusClass(product.status)}">{product.status}</span>
  </td>
</tr>
