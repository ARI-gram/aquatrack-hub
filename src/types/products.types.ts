/**
 * src/types/products.types.ts
 */

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type ProductUnit =
  | 'BOTTLES'
  | 'LITRES'
  | 'DOZENS'
  | 'PIECES'
  | 'CRATES'
  | 'JERRICANS'
  | 'SACHETS'
  | 'GALLONS'
  | 'PACKS'
  | 'CARTONS';

/** Full product shape — returned to admin / office views */
export interface Product {
  id:                string;
  name:              string;
  unit:              ProductUnit;
  unit_display:      string;
  dozen_size:        number | null;
  dozen_description: string;
  selling_price:     string;
  buying_price:      string;
  delivery_fee:      string;
  margin:            string;
  margin_pct:        number;
  image_url:         string;
  status:            ProductStatus;
  status_display:    string;
  is_available:      boolean;
  is_returnable:     boolean;
  stock_available:   number;
  created_at:        string;
  updated_at:        string;
}

/** Slim product shape — returned to customers only */
export interface CustomerProduct {
  id:                string;
  name:              string;
  unit:              ProductUnit;
  unit_display:      string;
  dozen_size:        number | null;
  dozen_description: string;
  selling_price:     string;
  delivery_fee:      string;
  image_url:         string;
  description?:      string;
  has_deposit?:      boolean;
  deposit_amount?:   string;
}

export interface CreateProductRequest {
  name:           string;
  unit:           ProductUnit;
  selling_price:  string | number;
  buying_price?:  string | number;
  delivery_fee?:  string | number;
  image_url?:     string;
  status?:        ProductStatus;
  is_available?:  boolean;
  is_returnable?: boolean;
  dozen_size?:    number | null;
}

export type UpdateProductRequest = Partial<CreateProductRequest>;

// ── Stock entries ─────────────────────────────────────────────────────────────

export interface StockEntry {
  id:               string;
  product:          string;
  product_name:     string;
  product_unit:     ProductUnit;
  serial_number:    string;
  quantity:         number;
  batch_ref:        string;
  received_by:      string | null;
  received_by_name: string;
  received_at:      string;
  notes:            string;
  created_at:       string;
}

export interface CreateStockEntryRequest {
  product:       string;
  serial_number: string;
  quantity:      number;
  batch_ref:     string;
  received_at:   string;
  notes?:        string;
}

export interface BatchStockRequest {
  product:     string;
  batch_ref:   string;
  received_at: string;
  notes?:      string;
  serials:     string[];
}

// ── Stock distributions ───────────────────────────────────────────────────────

export interface StockDistribution {
  id:                  string;
  product:             string;
  product_name:        string;
  product_unit:        ProductUnit;
  vehicle_number:      string;
  driver:              string | null;
  driver_name:         string | null;
  quantity:            number;
  distributed_by:      string | null;
  distributed_by_name: string | null;
  distributed_at:      string;
  notes:               string;
}

export interface DistributeStockRequest {
  product:        string;
  vehicle_number: string;
  quantity:       number;
  notes?:         string;
}

export interface DistributeStockResponse {
  distribution:        StockDistribution;
  warehouse_remaining: number;
}

export interface VanStockItem {
  product_id:   string;
  product_name: string;
  unit:         ProductUnit;
  quantity:     number;
}