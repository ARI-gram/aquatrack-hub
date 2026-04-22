/**
 * src/api/services/stock-request.service.ts
 *
 * Driver stock top-up requests.
 *
 * Endpoints:
 *   POST   /driver/store/request-topup/           → driver creates a request
 *   GET    /store/stock-requests/                  → admin lists all requests
 *   PATCH  /store/stock-requests/:id/approve/      → admin approves + triggers distribute
 *   PATCH  /store/stock-requests/:id/reject/       → admin rejects with reason
 */

import axiosInstance from '../axios.config';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StockRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIALLY_APPROVED';

export interface StockRequestLineItem {
  id:                  string;
  product_id:          string;
  product_name:        string;
  product_type:        'bottle' | 'consumable';
  unit?:               string;
  quantity_requested:  number;
  quantity_approved?:  number | null;
  /** Current balance on the driver's van at time of request */
  current_qty_at_request: number;
}

export interface StockRequest {
  id:               string;
  driver_id:        string;
  driver_name:      string;
  vehicle_number?:  string;
  delivery_id?:     string | null;
  delivery_order_number?: string | null;
  status:           StockRequestStatus;
  notes?:           string;
  rejection_reason?: string;
  items:            StockRequestLineItem[];
  created_at:       string;
  updated_at:       string;
  approved_at?:     string | null;
  approved_by_name?: string | null;
}

export interface CreateStockRequestPayload {
  items: Array<{
    product_id:         string;
    product_type:       'bottle' | 'consumable';
    quantity_requested: number;
  }>;
  delivery_id?: string;
  notes?:       string;
}

export interface ApproveStockRequestPayload {
  items: Array<{
    line_item_id:      string;
    quantity_approved: number;
  }>;
  notes?: string;
}

export interface RejectStockRequestPayload {
  reason: string;
}

export interface StockRequestListParams {
  status?:    StockRequestStatus | 'all';
  driver_id?: string;
  date_from?: string;
  date_to?:   string;
  page?:      number;
  limit?:     number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status normaliser
//
// The backend may return status in any casing, e.g. "approved", "Approved",
// "APPROVED". We always coerce to uppercase to match our StockRequestStatus
// union. Unknown values fall back to 'PENDING' so the UI never breaks.
// ─────────────────────────────────────────────────────────────────────────────

const VALID_STATUSES: StockRequestStatus[] = [
  'PENDING', 'APPROVED', 'REJECTED', 'PARTIALLY_APPROVED',
];

function normaliseStatus(raw: unknown): StockRequestStatus {
  if (typeof raw !== 'string') return 'PENDING';
  const upper = raw.toUpperCase() as StockRequestStatus;
  return VALID_STATUSES.includes(upper) ? upper : 'PENDING';
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisers — handle any backend shape variance
// ─────────────────────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;

function normaliseLineItem(raw: Raw): StockRequestLineItem {
  return {
    id:                     (raw.id ?? '') as string,
    product_id:             (raw.product_id ?? '') as string,
    product_name:           (raw.product_name ?? '') as string,
    product_type:           (raw.product_type ?? 'consumable') as 'bottle' | 'consumable',
    unit:                   raw.unit as string | undefined,
    quantity_requested:     Number(raw.quantity_requested ?? 0),
    quantity_approved:      raw.quantity_approved != null ? Number(raw.quantity_approved) : null,
    current_qty_at_request: Number(raw.current_qty_at_request ?? 0),
  };
}

function normaliseRequest(raw: Raw): StockRequest {
  const items = Array.isArray(raw.items)
    ? (raw.items as Raw[]).map(normaliseLineItem)
    : [];

  return {
    id:                    (raw.id ?? '') as string,
    driver_id:             (raw.driver_id ?? '') as string,
    driver_name:           (raw.driver_name ?? '') as string,
    vehicle_number:        raw.vehicle_number as string | undefined,
    delivery_id:           (raw.delivery_id ?? null) as string | null,
    delivery_order_number: (raw.delivery_order_number ?? raw.order_number ?? null) as string | null,
    // ↓ Always coerce to uppercase — fixes "approved" → "APPROVED" mismatch
    status:                normaliseStatus(raw.status),
    notes:                 raw.notes as string | undefined,
    rejection_reason:      raw.rejection_reason as string | undefined,
    items,
    created_at:            (raw.created_at ?? new Date().toISOString()) as string,
    updated_at:            (raw.updated_at ?? new Date().toISOString()) as string,
    approved_at:           (raw.approved_at ?? null) as string | null,
    approved_by_name:      (raw.approved_by_name ?? null) as string | null,
  };
}

function unwrap<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.data))    return r.data    as T[];
    if (Array.isArray(r.results)) return r.results as T[];
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export const stockRequestService = {

  // ── Driver ────────────────────────────────────────────────────────────────

  /** POST /driver/store/request-topup/ */
  async createRequest(payload: CreateStockRequestPayload): Promise<StockRequest> {
    const r = await axiosInstance.post<Raw>('/driver/store/request-topup/', payload);
    return normaliseRequest(r.data);
  },

  /** GET /driver/store/my-requests/ — driver's own request history */
  async getMyRequests(): Promise<StockRequest[]> {
    const r = await axiosInstance.get('/driver/store/my-requests/');
    return unwrap<Raw>(r.data).map(normaliseRequest);
  },

  // ── Admin / Store Manager ─────────────────────────────────────────────────

  /** GET /store/stock-requests/ */
  async listRequests(params?: StockRequestListParams): Promise<StockRequest[]> {
    const r = await axiosInstance.get('/store/stock-requests/', { params });
    return unwrap<Raw>(r.data).map(normaliseRequest);
  },

  /** GET /store/stock-requests/:id/ */
  async getRequest(id: string): Promise<StockRequest> {
    const r = await axiosInstance.get<Raw>(`/store/stock-requests/${id}/`);
    return normaliseRequest(r.data);
  },

  /**
   * PATCH /store/stock-requests/:id/approve/
   * Approving triggers the backend to distribute stock to the driver's van.
   */
  async approveRequest(
    id:      string,
    payload: ApproveStockRequestPayload,
  ): Promise<StockRequest> {
    const r = await axiosInstance.patch<Raw>(
      `/store/stock-requests/${id}/approve/`,
      payload,
    );
    return normaliseRequest(r.data);
  },

  /** PATCH /store/stock-requests/:id/reject/ */
  async rejectRequest(
    id:      string,
    payload: RejectStockRequestPayload,
  ): Promise<StockRequest> {
    const r = await axiosInstance.patch<Raw>(
      `/store/stock-requests/${id}/reject/`,
      payload,
    );
    return normaliseRequest(r.data);
  },

  /** Pending count — used for badge on nav / tab */
  async getPendingCount(): Promise<number> {
    try {
      const requests = await stockRequestService.listRequests({ status: 'PENDING' });
      return requests.length;
    } catch {
      return 0;
    }
  },
};

export default stockRequestService;