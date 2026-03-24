/**
 * Driver Store Service
 * src/api/services/driver-store.service.ts
 *
 * Manages stock on the driver's van:
 *  - GET  /driver/store/bottles/          → driver's bottle balances
 *  - GET  /driver/store/consumables/      → driver's consumable balances
 *  - GET  /driver/store/requirements/     → stock needed for today's pending deliveries
 *  - GET  /driver/store/history/          → driver's stock movement log
 *  - POST /driver/store/use/              → deduct stock (record usage)
 */

import axiosInstance from '../axios.config';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface DriverBottleBalance {
  full:    number;
  empty:   number;
  damaged: number;
  missing: number;
}

export interface DriverConsumableBalance {
  in_stock: number;
}

export interface DriverBottleStock {
  product_id:     string;
  product_name:   string;
  product_image?: string | null;
  selling_price?: string;        // ✅ added — decimal string e.g. "150.00"
  balance:        DriverBottleBalance;
  last_loaded?:   string | null;
}

export interface DriverConsumableStock {
  product_id:     string;
  product_name:   string;
  product_image?: string | null;
  unit?:          string;
  selling_price?: string;        // ✅ added — decimal string e.g. "50.00"
  balance:        DriverConsumableBalance;
  last_loaded?:   string | null;
}

/** What stock is needed to fulfil today's pending deliveries */
export interface DeliveryRequirement {
  product_id:      string;
  product_name:    string;
  product_type:    'bottle' | 'consumable';
  delivery_count:  number;
  bottles_needed:  number;
  bottles_collect: number;
  units_needed:    number;
}

export interface DriverStockHistory {
  id:             string;
  movement_type:  string;
  movement_date:  string;
  product_name:   string;
  quantity:       number;
  notes?:         string;
  unit_price?:     string;
}

export interface RecordUseRequest {
  product_id:   string;
  product_type: 'bottle' | 'consumable';
  quantity:     number;
  notes?:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — normalise whatever shape the backend returns
// ─────────────────────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;

function normaliseBottle(raw: Raw): DriverBottleStock {
  const bal = (raw.balance ?? raw.stock ?? {}) as Raw;
  return {
    product_id:    (raw.product_id    ?? raw.id   ?? '') as string,
    product_name:  (raw.product_name  ?? raw.name ?? '') as string,
    product_image: (raw.product_image ?? raw.image ?? null) as string | null,
    selling_price: raw.selling_price != null ? String(raw.selling_price) : undefined,  // ✅
    last_loaded:   (raw.last_loaded   ?? null) as string | null,
    balance: {
      full:    Number(bal.full    ?? 0),
      empty:   Number(bal.empty   ?? 0),
      damaged: Number(bal.damaged ?? 0),
      missing: Number(bal.missing ?? 0),
    },
  };
}

function normaliseConsumable(raw: Raw): DriverConsumableStock {
  const bal = (raw.balance ?? raw.stock ?? {}) as Raw;
  return {
    product_id:    (raw.product_id    ?? raw.id   ?? '') as string,
    product_name:  (raw.product_name  ?? raw.name ?? '') as string,
    product_image: (raw.product_image ?? raw.image ?? null) as string | null,
    unit:          (raw.unit ?? '') as string,
    selling_price: raw.selling_price != null ? String(raw.selling_price) : undefined,  // ✅
    last_loaded:   (raw.last_loaded   ?? null) as string | null,
    balance: { in_stock: Number(bal.in_stock ?? bal.quantity ?? 0) },
  };
}

function normaliseRequirement(raw: Raw): DeliveryRequirement {
  return {
    product_id:      (raw.product_id      ?? raw.id   ?? '') as string,
    product_name:    (raw.product_name    ?? raw.name ?? '') as string,
    product_type:    (raw.product_type    ?? 'consumable') as 'bottle' | 'consumable',
    delivery_count:  Number(raw.delivery_count  ?? raw.count   ?? 0),
    bottles_needed:  Number(raw.bottles_needed  ?? raw.qty     ?? 0),
    bottles_collect: Number(raw.bottles_collect ?? raw.collect ?? 0),
    units_needed:    Number(raw.units_needed    ?? raw.qty     ?? 0),
  };
}

function normaliseHistory(raw: Raw): DriverStockHistory {
  return {
    id:            (raw.id             ?? '') as string,
    movement_type: (raw.movement_type  ?? '') as string,
    movement_date: (raw.movement_date  ?? raw.created_at ?? new Date().toISOString()) as string,
    product_name:  (raw.product_name   ?? raw.name ?? '') as string,
    quantity:      Number(raw.quantity  ?? raw.qty  ?? 0),
    notes:         (raw.notes ?? undefined) as string | undefined,
    unit_price:    raw.unit_price != null ? String(raw.unit_price) : undefined, 
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export const driverStoreService = {

  /** Driver's bottle stock on the van */
  async getBottleStock(): Promise<DriverBottleStock[]> {
    try {
      const r = await axiosInstance.get<Raw[]>('/driver/store/bottles/');
      const data: Raw[] = Array.isArray(r.data) ? r.data :
        'data' in r.data && Array.isArray((r.data as Raw).data)
          ? (r.data as Raw).data as Raw[]
          : [];
      return data.map(normaliseBottle);
    } catch {
      return [];
    }
  },

  /** Driver's consumable stock on the van */
  async getConsumableStock(): Promise<DriverConsumableStock[]> {
    try {
      const r = await axiosInstance.get<Raw[]>('/driver/store/consumables/');
      const data: Raw[] = Array.isArray(r.data) ? r.data :
        'data' in r.data && Array.isArray((r.data as Raw).data)
          ? (r.data as Raw).data as Raw[]
          : [];
      return data.map(normaliseConsumable);
    } catch {
      return [];
    }
  },

  async getRequirements(): Promise<DeliveryRequirement[]> {
    try {
      const r = await axiosInstance.get<Raw[]>('/driver/store/requirements/');
      const data: Raw[] = Array.isArray(r.data) ? r.data :
        'data' in r.data && Array.isArray((r.data as Raw).data)
          ? (r.data as Raw).data as Raw[]
          : [];
      return data.map(normaliseRequirement);
    } catch {
      return [];
    }
  },

  /** Driver's own stock movement log */
  async getHistory(): Promise<DriverStockHistory[]> {
    try {
      const r = await axiosInstance.get<Raw[]>('/driver/store/history/');
      const data: Raw[] = Array.isArray(r.data) ? r.data :
        'data' in r.data && Array.isArray((r.data as Raw).data)
          ? (r.data as Raw).data as Raw[]
          : 'results' in r.data && Array.isArray((r.data as Raw).results)
            ? (r.data as Raw).results as Raw[]
            : [];
      return data.map(normaliseHistory);
    } catch {
      return [];
    }
  },

  async recordUse(data: {
    product_id:     string;
    product_type:   'bottle' | 'consumable';
    quantity:       number;
    qty_collected?: number;
    notes?:         string;
    customer_id?:   string;
    movement_type?: 'DIRECT_SALE' | 'DELIVERY_USE';
  }): Promise<void> {
    await axiosInstance.post('/driver/store/use/', {
      ...data,
      movement_type: data.movement_type ?? 'DIRECT_SALE',
    });
  },

  async getDirectSalesAdmin(params?: {
    date_from?: string;
    date_to?:   string;
    driver_id?: string;
  }): Promise<Array<{
    id:            string;
    movement_date: string;
    product_name:  string;
    product_type:  'bottle' | 'consumable';
    quantity:      number;
    driver_name:   string;
    driver_id:     string;
    notes:         string;
  }>> {
    const r = await axiosInstance.get('/driver/store/direct-sales/', { params });
    return r.data ?? [];
  },
};