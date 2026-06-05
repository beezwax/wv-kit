import React, { useCallback, useEffect, useState, createRoot } from '../shared/installed/react.js';
import filemakerScripts from '../shared/filemaker-scripts.js';
import { formatPrice } from '../shared/product-utils.js';
import type { DeleteResult, Product, SaveResult } from '../shared/types.js';

type SetProduct   = (p: Product) => void;
type SetSaveResult = (r: SaveResult) => void;

let _setProduct:    SetProduct    | null = null;
let _setSaveResult: SetSaveResult | null = null;
let _pendingProduct: Product | null = null;

export function registerSetProduct(fn: SetProduct) {
  _setProduct = fn;
  if (_pendingProduct) { fn(_pendingProduct); _pendingProduct = null; }
}
export function registerSetSaveResult(fn: SetSaveResult) { _setSaveResult = fn; }
export function updateProduct(p: Product)      { if (_setProduct) _setProduct(p); else _pendingProduct = p; }
export function updateSaveResult(r: SaveResult) { _setSaveResult?.(r); }

function ProductDetail() {
  const [product,    setProduct]    = useState<Product | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [saving,     setSaving]     = useState(false);

  const [name,        setName]        = useState('');
  const [sku,         setSku]         = useState('');
  const [category,    setCategory]    = useState('');
  const [price,       setPrice]       = useState(0);
  const [stock,       setStock]       = useState(0);
  const [status,      setStatus]      = useState<Product['status']>('active');
  const [description, setDescription] = useState('');

  useEffect(() => {
    registerSetProduct(p => {
      setProduct(p);
      setName(p.name); setSku(p.sku); setCategory(p.category);
      setPrice(p.price); setStock(p.stock); setStatus(p.status);
      setDescription(p.description);
    });
    registerSetSaveResult(r => {
      setSaving(false);
      setSaveResult(r);
      setTimeout(() => setSaveResult(null), 3000);
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!product) return;
    setSaving(true);
    filemakerScripts.saveProduct({ ...product, name, sku, category, price, stock, status, description });
  }, [product, name, sku, category, price, stock, status, description]);

  const handleDelete = useCallback(() => {
    if (product && confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      filemakerScripts.deleteProduct(product.id);
    }
  }, [product]);

  if (!product) {
    return <div className="container py-3"><p className="text-muted">Loading product…</p></div>;
  }

  return (
    <div className="container py-3">
      <div className="d-flex align-items-center gap-3 mb-4">
        <button className="btn btn-outline-secondary" type="button" onClick={() => filemakerScripts.navigateToList()}>
          ← List
        </button>
        <h1 className="fs-4 mb-0 flex-grow-1">{product?.id === 'new' ? 'New Product' : name}</h1>
        <span className="text-muted small">{product?.id === 'new' ? '' : `Updated: ${product?.updatedAt}`}</span>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <label className="form-label fw-medium">Name</label>
          <input className="form-control" type="text" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div className="col-md-6">
          <label className="form-label fw-medium">SKU</label>
          <input className="form-control" type="text" value={sku} onChange={e => setSku(e.target.value)} required />
        </div>
        <div className="col-md-4">
          <label className="form-label fw-medium">Category</label>
          <input className="form-control" type="text" value={category} onChange={e => setCategory(e.target.value)} />
        </div>
        <div className="col-md-4">
          <label className="form-label fw-medium">Price</label>
          <input className="form-control" type="number" step="0.01" min="0"
            value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="col-md-4">
          <label className="form-label fw-medium d-block">Formatted</label>
          <span className="form-control-plaintext fw-bold text-success fs-5">{formatPrice(price)}</span>
        </div>
        <div className="col-md-3">
          <label className="form-label fw-medium">Stock</label>
          <input className="form-control" type="number" min="0"
            value={stock} onChange={e => setStock(parseInt(e.target.value, 10) || 0)} />
        </div>
        <div className="col-md-3">
          <label className="form-label fw-medium">Status</label>
          <select className="form-select" value={status} onChange={e => setStatus(e.target.value as Product['status'])}>
            <option value="active">Active</option>
            <option value="discontinued">Discontinued</option>
          </select>
        </div>
        <div className="col-12">
          <label className="form-label fw-medium">Description</label>
          <textarea className="form-control" rows={3} value={description}
            onChange={e => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="d-flex gap-2 mt-4 pt-3 border-top">
        <button className="btn btn-primary" type="button" onClick={handleSave}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {product?.id !== 'new' && (
          <button className="btn btn-outline-danger ms-auto" type="button" onClick={handleDelete}>
            Delete
          </button>
        )}
      </div>

      {saveResult && (
        <div className={`alert alert-${saveResult.success ? 'success' : 'danger'} position-fixed bottom-0 end-0 m-3`}>
          {saveResult.success ? '✓ Saved' : `Error: ${saveResult.error}`}
        </div>
      )}
    </div>
  );
}

export default function buildApp(): HTMLElement {
  const container = document.createElement('div');
  queueMicrotask(() => createRoot(container).render(<ProductDetail />));
  return container;
}
