import filemakerScripts from '../shared/filemaker-scripts.js';
import { formatPrice, statusClass } from '../shared/product-utils.js';
import type { Product } from '../shared/types.js';

export function ProductRow({ product }: { product: Product }) {
  return (
    <tr style={{ cursor: 'pointer' }} onClick={() => filemakerScripts.navigateToDetail(product.id)}>
      <td className="fw-medium">{product.name}</td>
      <td><code className="text-muted">{product.sku}</code></td>
      <td>{product.category}</td>
      <td className="text-end">{formatPrice(product.price)}</td>
      <td className="text-end">{product.stock}</td>
      <td><span className={`badge bg-${statusClass(product.status)}`}>{product.status}</span></td>
    </tr>
  );
}
