/**
 * Customer Order Type Definitions
 * /src/types/customerOrder.types.ts
 *
 * Changes vs previous version:
 *   + otp_code field on DeliveryTrackingData  (shown to customer only)
 *   + otpCode / otpVerified on DeliveryTrackingData (camelCase aliases)
 *   + CustomerOrderTrackingResponse — shape of GET /customer/orders/{id}/track/
 *   + DeliveryDriver now includes vehicleNumber (was missing)
 */

// ─── ORDER STATUS ─────────────────────────────────────────────────────────────

export enum CustomerOrderStatus {
  DRAFT                  = 'DRAFT',
  PENDING_PAYMENT        = 'PENDING_PAYMENT',
  PENDING_CONFIRMATION   = 'PENDING_CONFIRMATION',
  CONFIRMED              = 'CONFIRMED',
  ASSIGNED               = 'ASSIGNED',
  IN_TRANSIT             = 'IN_TRANSIT',
  NEAR_YOU               = 'NEAR_YOU',
  DELIVERED              = 'DELIVERED',
  EXCHANGE_PENDING       = 'EXCHANGE_PENDING',
  COMPLETED              = 'COMPLETED',
  CANCELLED              = 'CANCELLED',
  FAILED                 = 'FAILED',
}

// Map backend Delivery.status → CustomerOrderStatus for the tracker
export const DELIVERY_STATUS_MAP: Record<string, CustomerOrderStatus> = {
  ASSIGNED:    CustomerOrderStatus.ASSIGNED,
  ACCEPTED:    CustomerOrderStatus.ASSIGNED,
  PICKED_UP:   CustomerOrderStatus.ASSIGNED,
  EN_ROUTE:    CustomerOrderStatus.IN_TRANSIT,
  ARRIVED:     CustomerOrderStatus.NEAR_YOU,
  IN_PROGRESS: CustomerOrderStatus.NEAR_YOU,
  COMPLETED:   CustomerOrderStatus.COMPLETED,
  FAILED:      CustomerOrderStatus.FAILED,
};

// ─── DRIVER INFO ──────────────────────────────────────────────────────────────

export interface DeliveryDriver {
  name:          string;
  phone:         string;
  vehicleNumber: string;
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────

export interface DeliveryTimeline {
  orderPlaced?:    string;   // ISO datetime
  confirmed?:      string;
  driverAssigned?: string;
  inTransit?:      string;
  arrived?:        string;
  delivered?:      string;
  completed?:      string;
}

// ─── BOTTLE SUMMARY ───────────────────────────────────────────────────────────

export interface DeliveryBottles {
  toDeliver: number;
  toCollect: number;
}

// ─── MAIN TRACKING DATA SHAPE ─────────────────────────────────────────────────

export interface DeliveryTrackingData {
  orderId:           string;
  orderNumber:       string;
  status:            CustomerOrderStatus;

  scheduledDate?:    string;     // 'YYYY-MM-DD'
  scheduledSlot?:    string;     // '10:00 AM – 12:00 PM'

  estimatedArrival?: string;     // ISO datetime

  driver?:           DeliveryDriver;

  /**
   * The 6-digit delivery confirmation code.
   * Only populated by GET /customer/orders/{id}/track/ (authenticated).
   * Null once verified or expired. Never present on the public /track/ endpoint.
   */
  otpCode?:          string | null;

  bottles:           DeliveryBottles;
  deliveryAddress?:  string;
  timeline:          DeliveryTimeline;
  totalAmount?:      string;
}

// ─── API RESPONSE SHAPES ─────────────────────────────────────────────────────

/**
 * Shape returned by GET /api/customer/orders/{id}/track/
 * (authenticated customer endpoint — includes OTP)
 */
export interface CustomerOrderTrackingResponse {
  order_id:              string;
  order_number:          string;
  status:                string;        // backend string e.g. 'ASSIGNED'
  status_display:        string;
  scheduled_date?:       string | null;
  scheduled_time_slot?:  string | null;
  delivery_address?:     string | null;
  address_label?:        string | null;
  estimated_arrival?:    string | null;

  driver?: {
    name:           string;
    phone:          string;
    vehicle_number: string;
  } | null;

  /**
   * SECRET — only this customer can see it.
   * Null once the driver has verified it, or if delivery is not yet assigned.
   */
  otp_code?: string | null;

  timeline: {
    order_placed?:    string | null;
    confirmed?:       string | null;
    driver_assigned?: string | null;
    picked_up?:       string | null;
    in_transit?:      string | null;
    arrived?:         string | null;
    delivered?:       string | null;
  };

  items_count:   number;
  total_amount:  string;
}

/**
 * Shape returned by GET /api/track/{orderNumber}/
 * (public endpoint — NO OTP)
 */
export interface PublicTrackingResponse {
  order_number:          string;
  status:                string;
  status_display:        string;
  customer_name?:        string | null;
  scheduled_date?:       string | null;
  scheduled_time_slot?:  string | null;
  delivery_address?:     string | null;
  estimated_delivery?:   string | null;

  driver?: {
    name:             string | null;
    vehicle_number:   string | null;
    current_location?: { lat: number; lng: number } | null;
  } | null;

  timeline?: {
    assigned?:   string | null;
    accepted?:   string | null;
    picked_up?:  string | null;
    in_transit?: string | null;
    arrived?:    string | null;
    completed?:  string | null;
  };
}

// ─── TRANSFORMER ─────────────────────────────────────────────────────────────

/**
 * Convert the authenticated tracking API response into the shape that
 * DeliveryTracker expects, including the OTP code.
 */
export function toDeliveryTrackingData(
  r: CustomerOrderTrackingResponse,
  bottlesToDeliver = 0,
  bottlesToCollect = 0,
): DeliveryTrackingData {
  const status = DELIVERY_STATUS_MAP[r.status] ?? CustomerOrderStatus.PENDING_CONFIRMATION;

  return {
    orderId:          r.order_id,
    orderNumber:      r.order_number,
    status,
    scheduledDate:    r.scheduled_date   ?? undefined,
    scheduledSlot:    r.scheduled_time_slot ?? undefined,
    estimatedArrival: r.estimated_arrival  ?? undefined,
    deliveryAddress:  r.delivery_address   ?? undefined,
    totalAmount:      r.total_amount,
    otpCode:          r.otp_code ?? null,

    driver: r.driver
      ? {
          name:          r.driver.name,
          phone:         r.driver.phone,
          vehicleNumber: r.driver.vehicle_number,
        }
      : undefined,

    bottles: {
      toDeliver: bottlesToDeliver,
      toCollect: bottlesToCollect,
    },

    timeline: {
      orderPlaced:    r.timeline.order_placed   ?? undefined,
      confirmed:      r.timeline.confirmed      ?? undefined,
      driverAssigned: r.timeline.driver_assigned ?? undefined,
      inTransit:      r.timeline.in_transit     ?? undefined,
      arrived:        r.timeline.arrived        ?? undefined,
      delivered:      r.timeline.delivered      ?? undefined,
    },
  };
}