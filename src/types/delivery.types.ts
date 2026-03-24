/**
 * Delivery Types
 */

export interface DriverDelivery {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  address_label: string;
  full_address: string;
  scheduled_date: string;
  scheduled_time_slot: string;
  items_count: number;
  bottles_to_deliver?: number;
  bottles_to_collect?: number;
  status: DeliveryStatus;
  status_display: string;
  status_color: string;
  estimated_arrival?: string;
  estimated_duration?: number;
  driver_notes?: string;
}

export interface ClientDelivery {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  driver_info: {
    id: string;
    name: string;
    phone: string;
    vehicle_number: string;
  } | null;
  scheduled_date: string;
  scheduled_time_slot: string;
  status: DeliveryStatus;
  status_display: string;
  status_color: string;
  estimated_arrival?: string;
  completed_at?: string;
  has_issues: boolean;
}

export interface DeliveryStats {
  total_today: number;
  completed_today: number;
  in_progress: number;
  failed_today: number;
  active_drivers: number;
  avg_delivery_time: number;
  revenue_today: number;
  status_breakdown: Record<string, number>;
}

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  today_assigned: number;
  today_completed: number;
}

export interface DriverProfile {
  driver: {
    id: string;
    name: string;
    email: string;
    phone: string;
    vehicle_number: string;
  };
  today_stats: {
    total: number;
    completed: number;
    failed: number;
    in_progress: number;
    pending: number;
  };
  next_delivery?: {
    id: string;
    order_number: string;
    customer_name: string;
    address: string;
    scheduled_time: string;
  };
  current_time: string;
}

export interface DriverDeliveriesResponse {
  date: string;
  count: number;
  deliveries: DriverDelivery[];
}

export interface DeliveryDetail {
  id: string;
  order: {
    id: string;
    order_number: string;
    order_type: string;
    total_amount: number;
    items_count: number;
    bottles_to_deliver?: number;
    bottles_to_collect?: number;
    scheduled_date?: string;
    scheduled_time_slot?: string;
    items?: DeliveryOrderItem[];
  };
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
  address: {
    label: string;
    full_address: string;
    instructions?: string;
    latitude?: number;
    longitude?: number;
  };
  status: DeliveryStatus;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  estimated_arrival?: string;
  estimated_duration?: number;
  current_latitude?: number;
  current_longitude?: number;
  distance_to_customer?: number;
  total_distance_travelled?: number;
  timeline: {
    assigned?: string;
    accepted?: string;
    picked_up?: string;
    started?: string;
    arrived?: string;
    completed?: string;
  };
  has_issues: boolean;
  issue_description?: string;
  driver_notes?: string;
}

export interface DeliveryOrderItem {
  product_name: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

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

export interface StatusUpdateData {
  status: DeliveryStatus;
  failure_reason?: string;
  failure_notes?: string;
  driver_notes?: string;
  customer_name_confirmed?: string;
}