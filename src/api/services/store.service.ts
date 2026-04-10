/**
 * src/api/services/store.service.ts
 *
 * Connects to the Django endpoints defined in apps/products/store_urls.py
 * Mounted at /api/store/ in the main router.
 *
 * All endpoints require role: client_admin | site_manager
 */

import axiosInstance from '../axios.config';
import type {
  BottleProductStore,
  ConsumableProductStore,
  BottleMovement,
  ConsumableMovement,
  BottleBalance,
  ConsumableBalance,
  ReceiveEmptyRequest,
  RefillRequest,
  DistributeBottleRequest,
  DirectSaleBottleRequest,
  ReceiveConsumableRequest,
  DistributeConsumableRequest,
  DirectSaleConsumableRequest,
} from '@/types/store.types';

// Re-export everything so consumers can import from a single place
export type {
  BottleProductStore,
  ConsumableProductStore,
  BottleMovement,
  ConsumableMovement,
  BottleBalance,
  ConsumableBalance,
  ReceiveEmptyRequest,
  RefillRequest,
  DistributeBottleRequest,
  DirectSaleBottleRequest,
  ReceiveConsumableRequest,
  DistributeConsumableRequest,
  DirectSaleConsumableRequest,
} from '@/types/store.types';

// ── Driver van stock ──────────────────────────────────────────────────────────

export interface DriverVanBottleItem {
  product_id:    string;
  product_name:  string;
  selling_price: string | null;
  balance: {
    full:    number;
    empty:   number;
    damaged: number;
    missing: number;
  };
}

export interface DriverVanConsumableItem {
  product_id:    string;
  product_name:  string;
  unit:          string;
  selling_price: string | null;
  balance: {
    in_stock: number;
  };
}

export interface DriverVanStock {
  driver_id:      string;
  driver_name:    string;
  vehicle_number: string;
  total_items:    number;
  bottles:        DriverVanBottleItem[];
  consumables:    DriverVanConsumableItem[];
}

export const driverVanStockService = {
  /**
   * GET /api/store/driver-stock/
   * Returns current van inventory for every active driver in the client.
   */
  async getAll(): Promise<DriverVanStock[]> {
    const r = await axiosInstance.get<DriverVanStock[]>('/store/driver-stock/');
    return unwrapArray<DriverVanStock>(r.data);
  },
};

// ── Response wrappers ─────────────────────────────────────────────────────────

interface BottleMovementResponse {
  movement: BottleMovement;
  balance:  BottleBalance;
}

interface ConsumableMovementResponse {
  movement: ConsumableMovement;
  balance:  ConsumableBalance;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * The backend returns arrays directly (not paginated).
 * Guard against any unexpected wrapper shapes just in case.
 */
function unwrapArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  // some proxies/interceptors wrap responses: { data: [...] }
  if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray((raw as { data: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

// ── Bottle service ────────────────────────────────────────────────────────────

export const bottleStoreService = {

  async openingStock(data: {
    product: string;
    qty_full: number;
    qty_empty: number;
    notes?: string;
  }): Promise<{ movement: unknown; balance: BottleBalance }> {
    const r = await axiosInstance.post('/store/bottles/opening-stock/', data);
    return r.data;
  },

  /**
   * GET /api/store/bottles/
   *
   * Returns balance + last 20 movements for every active returnable product
   * belonging to the current user's client.
   *
   * Backend: BottleStoreView.get()
   */
  async getAll(): Promise<BottleProductStore[]> {
    const r = await axiosInstance.get<BottleProductStore[]>('/store/bottles/');
    return unwrapArray<BottleProductStore>(r.data);
  },

  /**
   * POST /api/store/bottles/receive-empty/
   *
   * Driver returns empty bottles to the warehouse.
   * qty_missing is computed server-side as: expected − good − damaged
   *
   * Backend: ReceiveEmptyView.post()
   */
  async receiveEmpty(data: ReceiveEmptyRequest): Promise<BottleMovementResponse> {
    const r = await axiosInstance.post<BottleMovementResponse>(
      '/store/bottles/receive-empty/',
      data,
    );
    return r.data;
  },

  /**
   * POST /api/store/bottles/refill/
   *
   * Mark empties as refilled → moves them from empty stock to full stock.
   * Server validates: quantity ≤ current empty balance.
   *
   * Backend: RefillBottlesView.post()
   */
  async refill(data: RefillRequest): Promise<BottleMovementResponse> {
    const r = await axiosInstance.post<BottleMovementResponse>(
      '/store/bottles/refill/',
      data,
    );
    return r.data;
  },

  /**
   * POST /api/store/bottles/distribute/
   *
   * Load full bottles onto a van.
   * Server validates: quantity ≤ current full balance.
   *
   * Backend: DistributeBottlesView.post()
   */
  async distribute(data: DistributeBottleRequest): Promise<BottleMovementResponse> {
    const r = await axiosInstance.post<BottleMovementResponse>(
      '/store/bottles/distribute/',
      data,
    );
    return r.data;
  },

  /**
   * POST /api/store/bottles/direct-sale/
   *
   * Sell directly to a walk-in customer.
   * Server validates: quantity ≤ current full balance.
   *
   * Backend: DirectSaleBottleView.post()
   */

  async directSale(data: {
    product:        string;
    quantity:       number;
    customer_id?:   string;
    customer_name?: string;
    qty_collected?: number;
    notes?:         string;
  }): Promise<{
    movement:      BottleMovement;
    balance:       BottleBalance;
    qty_collected: number;
    outstanding:   number;
  }> {
    const r = await axiosInstance.post('/store/bottles/direct-sale/', data);
    return r.data;
  },
};

// ── Consumable service ────────────────────────────────────────────────────────

export const consumableStoreService = {

  /**
   * GET /api/store/consumables/
   *
   * Returns balance + last 20 movements for every active non-returnable
   * product belonging to the current user's client.
   *
   * Backend: ConsumableStoreView.get()
   */
  async getAll(): Promise<ConsumableProductStore[]> {
    const r = await axiosInstance.get<ConsumableProductStore[]>('/store/consumables/');
    return unwrapArray<ConsumableProductStore>(r.data);
  },

  /**
   * POST /api/store/consumables/receive/
   *
   * Receive stock from a supplier.
   *
   * Backend: ReceiveConsumableView.post()
   */
  async receive(data: ReceiveConsumableRequest): Promise<ConsumableMovementResponse> {
    const r = await axiosInstance.post<ConsumableMovementResponse>(
      '/store/consumables/receive/',
      data,
    );
    return r.data;
  },

  /**
   * POST /api/store/consumables/distribute/
   *
   * Load consumables onto a van.
   * Server validates: quantity ≤ current in_stock balance.
   *
   * Backend: DistributeConsumableView.post()
   */
  async distribute(data: DistributeConsumableRequest): Promise<ConsumableMovementResponse> {
    const r = await axiosInstance.post<ConsumableMovementResponse>(
      '/store/consumables/distribute/',
      data,
    );
    return r.data;
  },

  /**
   * POST /api/store/consumables/direct-sale/
   *
   * Backend: DirectSaleConsumableView.post()
   */
  async directSale(data: DirectSaleConsumableRequest): Promise<ConsumableMovementResponse> {
    const r = await axiosInstance.post<ConsumableMovementResponse>(
      '/store/consumables/direct-sale/',
      data,
    );
    return r.data;
  },
};