/**
 * Delivery Types
 * src/types/delivery.types.ts
 */

// ── Status ────────────────────────────────────────────────────────────────────

export type DeliveryStatus =
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PICKED_UP'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED';

// ── Order items ───────────────────────────────────────────────────────────────

/** Per-item detail returned by DriverDeliveryListSerializer */
export interface OrderItem {
  id:            string;
  product_id:    string;
  product_name:  string;
  product_unit:  'BOTTLES' | 'LITRES' | 'DOZENS' | 'PIECES' | 'CRATES' | 'SACHETS' | string;
  is_returnable: boolean;
  quantity:      number;
}

/** Legacy line item shape used in DeliveryDetail */
export interface DeliveryOrderItem {
  product_name: string;
  quantity:     number;
  unit_price:   string;
  subtotal:     string;
}

// ── Partial delivery adjustment ───────────────────────────────────────────────

/** One item's delivered-vs-ordered entry sent to the complete endpoint */
export interface DeliveredItem {
  /** OrderItem UUID */
  order_item_id: string;
  /** How many units the driver actually handed to the customer */
  qty_delivered: number;
}

/** One shortfall line returned in the adjustment response */
export interface AdjustmentLine {
  product_name:  string;
  ordered_qty:   number;
  delivered_qty: number;
  shortfall_qty: number;
  unit_price:    number;
  /** KES amount deducted for this line */
  deducted_amt:  number;
  /** Human-readable explanation e.g. "Partial delivery: 1 of 3 BOTTLES delivered…" */
  reason:        string;
}

/** Always present in CompleteDeliveryResponse — applied=false when fully delivered */
export interface DeliveryAdjustment {
  applied:          boolean;
  original_amount?: number;
  total_deducted?:  number;
  adjusted_amount?: number;
  invoice_number?:  string | null;
  lines?:           AdjustmentLine[];
}

// ── Complete delivery ─────────────────────────────────────────────────────────

export interface CompleteDeliveryRequest {
  customer_name_confirmed?: string;
  driver_notes?:            string;
  customer_rating?:         number;
  customer_feedback?:       string;

  /**
   * Per-item delivery confirmation.
   * Include every order item — even fully delivered ones — for accuracy.
   * If omitted, the legacy bottles_delivered total is used as a fallback.
   */
  delivered_items?: DeliveredItem[];

  /** Legacy fields — used when delivered_items is unavailable (old app versions) */
  bottles_delivered?: number;
  bottles_collected?: number;

  amount_collected?:         number;
  payment_method_collected?: 'CASH' | 'MPESA';
}

export interface CompleteDeliveryResponse {
  message:             string;
  completed_at:        string;
  /** Always present. Check applied === true before reading the other fields. */
  delivery_adjustment: DeliveryAdjustment;
}

// ── Driver-facing list ────────────────────────────────────────────────────────

export interface DriverDelivery {
  id:                   string;
  order_number:         string;
  customer_name:        string;
  customer_phone:       string;
  address_label:        string;
  full_address:         string;
  scheduled_date:       string;
  scheduled_time_slot:  string;
  items_count:          number;
  bottles_to_deliver?:  number;
  bottles_to_collect?:  number;
  /** Full per-item breakdown — use these for the completion stepper */
  order_items?:         OrderItem[];
  status:               DeliveryStatus;
  status_display:       string;
  status_color:         string;
  estimated_arrival?:   string;
  estimated_duration?:  number;
  driver_notes?:        string;
  order_payment_method?: string;
  order_total_amount?:   string;
}

export interface DriverDeliveriesResponse {
  date:       string | null;
  count:      number;
  deliveries: DriverDelivery[];
}

// ── Driver delivery detail ────────────────────────────────────────────────────

export interface DeliveryDetail {
  id: string;
  order: {
    id:                  string;
    order_number:        string;
    order_type:          string;
    total_amount:        string;
    items_count:         number;
    bottles_to_deliver?: number;
    bottles_to_collect?: number;
    scheduled_date?:     string;
    scheduled_time_slot?: string;
    subtotal?:           string;
    delivery_fee?:       string;
    discount_amount?:    string;
    payment_method?:     string;
    payment_status?:     string;
    items?:              OrderItem[];
  };
  customer: {
    name:   string;
    phone:  string;
    email?: string;
  };
  address: {
    label:         string;
    full_address:  string;
    instructions?: string;
    latitude?:     number;
    longitude?:    number;
  };
  status:                    DeliveryStatus;
  vehicle_number?:           string;
  driver_name?:              string;
  driver_phone?:             string;
  estimated_arrival?:        string;
  estimated_duration?:       number;
  current_latitude?:         number;
  current_longitude?:        number;
  distance_to_customer?:     number;
  total_distance_travelled?: number;
  timeline: {
    assigned?:  string | null;
    accepted?:  string | null;
    picked_up?: string | null;
    started?:   string | null;
    arrived?:   string | null;
    completed?: string | null;
  };
  has_issues:        boolean;
  issue_description?: string;
  driver_notes?:      string;
}

// ── Client-facing list ────────────────────────────────────────────────────────

export interface ClientDelivery {
  id:                  string;
  order_number:        string;
  customer_name:       string;
  customer_phone:      string;
  driver_info: {
    id:             string;
    name:           string;
    phone:          string;
    vehicle_number: string;
  } | null;
  scheduled_date:      string;
  scheduled_time_slot: string;
  status:              DeliveryStatus;
  status_display:      string;
  status_color:        string;
  estimated_arrival?:  string;
  completed_at?:       string;
  has_issues:          boolean;
  total_amount?:       number;
  is_empty_return?:    boolean;
  created_at?:         string;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface DeliveryStats {
  total_today:       number;
  completed_today:   number;
  in_progress:       number;
  failed_today:      number;
  active_drivers:    number;
  avg_delivery_time: number;
  revenue_today:     number;
  status_breakdown:  Record<string, number>;
}

// ── Driver / assignment ───────────────────────────────────────────────────────

export interface Driver {
  id:              string;
  name:            string;
  email:           string;
  phone:           string;
  vehicle_number:  string;
  today_assigned:  number;
  today_completed: number;
}

export interface AssignOrderResult {
  message:               string;
  assigned_count:        number;
  scheduled_date:        string | null;
  scheduled_time_slot:   string | null;
  driver: {
    id:             string;
    name:           string;
    phone:          string;
    vehicle_number: string;
  };
}

export interface DriverProfile {
  driver: {
    id:             string;
    name:           string;
    email:          string;
    phone:          string;
    vehicle_number: string;
  };
  today_stats: {
    total:       number;
    completed:   number;
    failed:      number;
    in_progress: number;
    pending:     number;
  };
  next_delivery?: {
    id:            string;
    order_number:  string;
    customer_name: string;
    address:       string;
    scheduled_time: string;
  };
  current_time: string;
}

// ── Status update ─────────────────────────────────────────────────────────────

export interface StatusUpdateData {
  status:                   DeliveryStatus;
  failure_reason?:          string;
  failure_notes?:           string;
  driver_notes?:            string;
  customer_name_confirmed?: string;
}