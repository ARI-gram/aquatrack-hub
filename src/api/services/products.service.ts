/**
 * Product Catalogue Service
 * src/api/services/products.service.ts
 */

import axiosInstance from '../axios.config';
import type {
  Product,
  CustomerProduct,
  CreateProductRequest,
  UpdateProductRequest,
  StockEntry,
  CreateStockEntryRequest,
  BatchStockRequest,
  StockDistribution,
  DistributeStockRequest,
  DistributeStockResponse,
  VanStockItem,
} from '@/types/products.types';

export type {
  Product,
  CustomerProduct,
  CreateProductRequest,
  UpdateProductRequest,
  StockEntry,
  CreateStockEntryRequest,
  BatchStockRequest,
  StockDistribution,
  DistributeStockRequest,
  DistributeStockResponse,
  VanStockItem,
  ProductStatus,
  ProductUnit,
} from '@/types/products.types';

// ── Admin — Products ──────────────────────────────────────────────────────────

export const productsService = {

  async getProducts(params?: { status?: string; search?: string; unit?: string }): Promise<Product[]> {
    const r = await axiosInstance.get<Product[]>('/products/', { params });
    return r.data;
  },

  async getProduct(id: string): Promise<Product> {
    const r = await axiosInstance.get<Product>(`/products/${id}/`);
    return r.data;
  },

  async createProduct(data: CreateProductRequest): Promise<Product> {
    const r = await axiosInstance.post<Product>('/products/', data);
    return r.data;
  },

  async updateProduct(id: string, data: UpdateProductRequest): Promise<Product> {
    const r = await axiosInstance.patch<Product>(`/products/${id}/`, data);
    return r.data;
  },

  async archiveProduct(id: string): Promise<{ message: string }> {
    const r = await axiosInstance.delete(`/products/${id}/`);
    return r.data;
  },

  async toggleProduct(id: string): Promise<{ message: string; product: Product }> {
    const r = await axiosInstance.post<{ message: string; product: Product }>(
      `/products/${id}/toggle/`,
    );
    return r.data;
  },
};

// ── Admin — Stock ─────────────────────────────────────────────────────────────

export const stockService = {

  /** Single stock entry (legacy / one-off use) */
  async createEntry(data: CreateStockEntryRequest): Promise<StockEntry> {
    const r = await axiosInstance.post<StockEntry>('/stock/', data);
    return r.data;
  },

  /**
   * Batch create — one entry per serial, all in one transaction.
   * POST /api/stock/batch/
   */
  async createBatch(data: BatchStockRequest): Promise<StockEntry[]> {
    const r = await axiosInstance.post<{ entries: StockEntry[]; count: number }>(
      '/stock/batch/',
      data,
    );
    return r.data.entries;
  },

  async getEntries(params?: {
    product_id?: string;
    search?:     string;
    from_date?:  string;
    to_date?:    string;
  }): Promise<StockEntry[]> {
    const r = await axiosInstance.get<StockEntry[]>('/stock/', { params });
    return r.data;
  },

  async getEntry(id: string): Promise<StockEntry> {
    const r = await axiosInstance.get<StockEntry>(`/stock/${id}/`);
    return r.data;
  },
};

// ── Admin — Distribution (warehouse → van) ────────────────────────────────────

export const distributionService = {

  async distribute(data: DistributeStockRequest): Promise<DistributeStockResponse> {
    const r = await axiosInstance.post<DistributeStockResponse>(
      '/products/distribute/',
      data,
    );
    return r.data;
  },

  async getVanStock(vehicleNumber: string): Promise<{ vehicle_number: string; stock: VanStockItem[] }> {
    const r = await axiosInstance.get('/products/distribute/', {
      params: { vehicle_number: vehicleNumber },
    });
    return r.data;
  },

  async getHistory(params?: {
    vehicle_number?: string;
    product_id?:     string;
    page?:           number;
    limit?:          number;
  }): Promise<{
    data:        StockDistribution[];
    total:       number;
    page:        number;
    limit:       number;
    total_pages: number;
  }> {
    const r = await axiosInstance.get('/products/distribute/history/', { params });
    return r.data;
  },
};

// ── Customer — Products ───────────────────────────────────────────────────────

export const customerProductsService = {
  async getProducts(): Promise<CustomerProduct[]> {
    const r = await axiosInstance.get<CustomerProduct[]>('/customer/products/');
    return r.data;
  },
};

export default productsService;