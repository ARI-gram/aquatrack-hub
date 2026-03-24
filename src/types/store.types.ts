/**
 * src/types/store.types.ts
 *
 * TypeScript types that exactly mirror the Django serializers in
 * apps/products/store_views.py and apps/products/serializers.py
 */

// ── Shared ────────────────────────────────────────────────────────────────────

export type BottleMovementType =
  | 'RECEIVE_EMPTY'
  | 'REFILL'
  | 'DISTRIBUTE'
  | 'DIRECT_SALE';

export type ConsumableMovementType =
  | 'RECEIVE'
  | 'DISTRIBUTE'
  | 'DIRECT_SALE';

// ── Balances ──────────────────────────────────────────────────────────────────

/** _bottle_balance() return shape */
export interface BottleBalance {
  full:    number;
  empty:   number;
  damaged: number;
  missing: number;
}

/** _consumable_balance() return shape */
export interface ConsumableBalance {
  in_stock: number;
}

// ── Movement serializer shapes ────────────────────────────────────────────────

/** BottleMovementSerializer output */
export interface BottleMovement {
  id:                    string;
  product:               string;   // UUID
  product_name:          string;
  movement_type:         BottleMovementType;
  movement_type_display: string;

  qty_good:     number;
  qty_damaged:  number;
  qty_missing:  number;
  qty_expected: number;
  qty_total:    number;  // read_only = qty_good + qty_damaged + qty_missing

  driver:            string | null;   // UUID
  driver_name:       string | null;
  vehicle_number:    string;

  customer:      string | null;   // UUID
  customer_name: string;

  notes:            string;
  recorded_by:      string | null;
  recorded_by_name: string | null;
  movement_date:    string;   // ISO datetime
}

/** ConsumableMovementSerializer output */
export interface ConsumableMovement {
  id:                    string;
  product:               string;
  product_name:          string;
  movement_type:         ConsumableMovementType;
  movement_type_display: string;

  quantity: number;

  driver:         string | null;
  driver_name:    string | null;
  vehicle_number: string;

  customer:      string | null;
  customer_name: string;

  supplier_name: string;
  unit_price:    string | null;   // Decimal serialised as string

  notes:            string;
  recorded_by:      string | null;
  recorded_by_name: string | null;
  movement_date:    string;
}

// ── GET /api/store/bottles/ ───────────────────────────────────────────────────

/** One element of the array returned by BottleStoreView.get() */
export interface BottleProductStore {
  product_id:   string;
  product_name: string;
  balance:      BottleBalance;
  history:      BottleMovement[];
}

// ── GET /api/store/consumables/ ───────────────────────────────────────────────

/** One element of the array returned by ConsumableStoreView.get() */
export interface ConsumableProductStore {
  product_id:   string;
  product_name: string;
  unit:         string;   // e.g. 'BOTTLES' | 'LITRES' | 'DOZENS'
  balance:      ConsumableBalance;
  history:      ConsumableMovement[];
}

// ── POST request bodies ───────────────────────────────────────────────────────

/** POST /api/store/bottles/receive-empty/ */
export interface ReceiveEmptyRequest {
  product:       string;   // UUID
  driver_id?:    string;
  qty_expected:  number;
  qty_good:      number;
  qty_damaged:   number;
  /** Omit — server computes as expected − good − damaged */
  notes?:        string;
}

/** POST /api/store/bottles/refill/ */
export interface RefillRequest {
  product:   string;
  quantity:  number;
  notes?:    string;
}

/** POST /api/store/bottles/distribute/ */
export interface DistributeBottleRequest {
  product:    string;
  driver_id?: string;
  quantity:   number;
  notes?:     string;
}

/** POST /api/store/bottles/direct-sale/ */
export interface DirectSaleBottleRequest {
  product:       string;
  quantity:      number;
  customer_id?:  string;
  customer_name?: string;
  notes?:        string;
}

/** POST /api/store/consumables/receive/ */
export interface ReceiveConsumableRequest {
  product:        string;
  quantity:       number;
  supplier_name?: string;
  notes?:         string;
}

/** POST /api/store/consumables/distribute/ */
export interface DistributeConsumableRequest {
  product:    string;
  driver_id?: string;
  quantity:   number;
  notes?:     string;
}

/** POST /api/store/consumables/direct-sale/ */
export interface DirectSaleConsumableRequest {
  product:        string;
  quantity:       number;
  customer_id?:   string;
  customer_name?: string;
  unit_price?:    number;
  notes?:         string;
}