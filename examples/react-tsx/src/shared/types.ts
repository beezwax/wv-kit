export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: 'active' | 'discontinued';
  description: string;
  updatedAt: string;
}

export interface SaveResult {
  success: boolean;
  error?: string;
  product?: Product;
}

export interface DeleteResult {
  success: boolean;
  id: string;
}
