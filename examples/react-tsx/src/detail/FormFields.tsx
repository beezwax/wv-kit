import { formatPrice } from '../shared/product-utils.js';
import type { Product } from '../../fm/schema.js';

interface FormFieldsProps {
  name: string;
  onNameChange: (value: string) => void;
  sku: string;
  onSkuChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  price: number;
  onPriceChange: (value: number) => void;
  stock: number;
  onStockChange: (value: number) => void;
  status: Product['status'];
  onStatusChange: (value: Product['status']) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
}

export function FormFields({
  name, onNameChange,
  sku, onSkuChange,
  category, onCategoryChange,
  price, onPriceChange,
  stock, onStockChange,
  status, onStatusChange,
  description, onDescriptionChange,
}: FormFieldsProps) {
  return (
    <div className="row g-3">
      <div className="col-md-6">
        <label className="form-label fw-medium">Name</label>
        <input className="form-control" type="text" value={name} onChange={e => onNameChange(e.target.value)} required />
      </div>
      <div className="col-md-6">
        <label className="form-label fw-medium">SKU</label>
        <input className="form-control" type="text" value={sku} onChange={e => onSkuChange(e.target.value)} required />
      </div>
      <div className="col-md-4">
        <label className="form-label fw-medium">Category</label>
        <input className="form-control" type="text" value={category} onChange={e => onCategoryChange(e.target.value)} />
      </div>
      <div className="col-md-4">
        <label className="form-label fw-medium">Price</label>
        <input className="form-control" type="number" step="0.01" min="0"
          value={price} onChange={e => onPriceChange(parseFloat(e.target.value) || 0)} />
      </div>
      <div className="col-md-4">
        <label className="form-label fw-medium d-block">Formatted</label>
        <span className="form-control-plaintext fw-bold text-success fs-5">{formatPrice(price)}</span>
      </div>
      <div className="col-md-3">
        <label className="form-label fw-medium">Stock</label>
        <input className="form-control" type="number" min="0"
          value={stock} onChange={e => onStockChange(parseInt(e.target.value, 10) || 0)} />
      </div>
      <div className="col-md-3">
        <label className="form-label fw-medium">Status</label>
        <select className="form-select" value={status} onChange={e => onStatusChange(e.target.value as Product['status'])}>
          <option value="active">Active</option>
          <option value="discontinued">Discontinued</option>
        </select>
      </div>
      <div className="col-12">
        <label className="form-label fw-medium">Description</label>
        <textarea className="form-control" rows={3} value={description}
          onChange={e => onDescriptionChange(e.target.value)} />
      </div>
    </div>
  );
}
