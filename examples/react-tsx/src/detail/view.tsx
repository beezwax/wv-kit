import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { fmScripts } from '../../fm/fm-scripts.js';
import type { DeleteResult, Product, SaveResult } from '../../fm/schema.js';
import { FormFields } from './FormFields.js';

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
    fmScripts.saveProduct({ ...product, name, sku, category, price, stock, status, description });
  }, [product, name, sku, category, price, stock, status, description]);

  const handleDelete = useCallback(() => {
    if (product && confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      fmScripts.deleteProduct({ id: product.id });
    }
  }, [product]);

  if (!product) {
    return <div className="container py-3"><p className="text-muted">Loading product…</p></div>;
  }

  return (
    <div className="container py-3">
      <div className="d-flex align-items-center gap-3 mb-4">
        <button className="btn btn-outline-secondary" type="button" onClick={() => fmScripts.navigateToList()}>
          ← List
        </button>
        <h1 className="fs-4 mb-0 flex-grow-1">{product?.id === 'new' ? 'New Product' : name}</h1>
        <span className="text-muted small">{product?.id === 'new' ? '' : `Updated: ${product?.updatedAt}`}</span>
      </div>

      <FormFields
        name={name} onNameChange={setName}
        sku={sku} onSkuChange={setSku}
        category={category} onCategoryChange={setCategory}
        price={price} onPriceChange={setPrice}
        stock={stock} onStockChange={setStock}
        status={status} onStatusChange={setStatus}
        description={description} onDescriptionChange={setDescription}
      />

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
