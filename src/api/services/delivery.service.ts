/**
 * Delivery Service
 * src/api/services/delivery.service.ts
 *
 * NOTE: axiosInstance already has `/api` as its baseURL.
 * All paths here are relative to that — do NOT include a leading `/api`.
 */

import axiosInstance from '../axios.config';

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
  status: string;
  status_display: string;
  status_color: string;
  estimated_arrival?: string;
  estimated_duration?: number;
  driver_notes?: string;
  order_payment_method?: string;
  order_total_amount?: string;
}

export interface OrderItem {
  id:            string;
  product_id:    string;
  product_name:  string;
  product_unit:  'BOTTLES' | 'LITRES' | 'DOZENS' | string;
  is_returnable: boolean;
  quantity:      number;
}

/**
 * Matches the response from DriverDeliveryDetailSerializer.
 * Note: scheduled_date / scheduled_time_slot live inside order.delivery
 * (the OrderDelivery record), not directly on order.
 */
export interface DriverDeliveryDetail {
  id: string;
  status: string;
  vehicle_number: string;
  estimated_arrival?: string;
  estimated_duration?: number;
  current_latitude?: number;
  current_longitude?: number;
  distance_to_customer?: number;
  total_distance_travelled?: number;
  has_issues: boolean;
  issue_description?: string;
  driver_notes?: string;

  order: {
    id: string;
    order_number: string;
    order_type: string;
    total_amount: string;
    items_count: number;
    bottles_to_deliver?: number;
    bottles_to_collect?: number;
    items?: OrderItem[];
    scheduled_date?: string;
    scheduled_time_slot?: string;

    // ── Add these ──────────────────────────────────
    subtotal?: string;
    delivery_fee?: string;
    discount_amount?: string;
    payment_method?: string;
    payment_status?: string;
  };

  customer: {
    name: string;
    phone: string;
    email?: string;
  };

  address: {
    label: string;
    full_address: string;
    latitude?: number;
    longitude?: number;
    instructions?: string;
  };

  driver_name: string;
  driver_phone?: string;

  timeline: {
    assigned?: string | null;
    accepted?: string | null;
    picked_up?: string | null;
    started?: string | null;
    arrived?: string | null;
    completed?: string | null;
  };
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
  status: string;
  status_display: string;
  status_color: string;
  estimated_arrival?: string;
  completed_at?: string;
  has_issues: boolean;
  total_amount: number;
  is_empty_return: boolean;
  created_at: string;
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
  vehicle_number: string;   
  today_assigned: number;
  today_completed: number;
}

export interface AssignOrderResult {
  message: string;
  assigned_count: number;
  scheduled_date: string | null;        
  scheduled_time_slot: string | null;   
  driver: {
    id: string;
    name: string;
    phone: string;
    vehicle_number: string;
  };
}

export const deliveryService = {
  // ── Client ────────────────────────────────────────────────────────────────

  async getClientDeliveries(params?: { status?: string; driver_id?: string; date_from?: string; date_to?: string; search?: string; page?: number; limit?: number; }) {
    const response = await axiosInstance.get('/client/deliveries/', { params });
    return response.data;
  },

  async getDeliveryStats() {
    const response = await axiosInstance.get<DeliveryStats>('/client/deliveries/stats/');
    return response.data;
  },

  async getAvailableDrivers() {
    const response = await axiosInstance.get<Driver[]>('/client/drivers/available/');
    return response.data;
  },

  async assignOrderToDriver(
    orderId: string,
    driverId: string,
    scheduledDate?: string,
    scheduledTimeSlot?: string,
  ): Promise<AssignOrderResult> {
    const response = await axiosInstance.post<AssignOrderResult>(
      '/client/orders/assign/',
      {
        order_ids: [orderId],
        driver_id: driverId,
        ...(scheduledDate     ? { scheduled_date:      scheduledDate }     : {}),
        ...(scheduledTimeSlot ? { scheduled_time_slot: scheduledTimeSlot } : {}),
      },
    );
    return response.data;
  },

  async assignDeliveries(
    deliveryIds: string[],
    driverId: string,
    scheduledDate?: string,
    scheduledTimeSlot?: string,
  ): Promise<AssignOrderResult> {
    const response = await axiosInstance.post<AssignOrderResult>(
      '/client/deliveries/assign/',
      {
        delivery_ids: deliveryIds,
        driver_id:    driverId,
        ...(scheduledDate     ? { scheduled_date:      scheduledDate }     : {}),
        ...(scheduledTimeSlot ? { scheduled_time_slot: scheduledTimeSlot } : {}),
      },
    );
    return response.data;
  },

  // ── Driver ────────────────────────────────────────────────────────────────

  async getDriverDeliveries(date?: string, status?: string) {
    const params: Record<string, string> = {};
    if (date)   params.date   = date;
    if (status) params.status = status;
    const response = await axiosInstance.get('/driver/deliveries/', { params });
    return response.data;
  },

  async getDriverDeliveryDetail(deliveryId: string): Promise<DriverDeliveryDetail> {
    const response = await axiosInstance.get<DriverDeliveryDetail>(`/driver/deliveries/${deliveryId}/`);
    return response.data;
  },

  async getDriverProfile() {
    const response = await axiosInstance.get('/driver/profile/');
    return response.data;
  },

  async acceptDelivery(deliveryId: string): Promise<{ message: string; status: string; accepted_at: string }> {
    const response = await axiosInstance.post(`/driver/deliveries/${deliveryId}/accept/`, {
      accepted: true,
    });
    return response.data;
  },
  
  async declineDelivery(deliveryId: string, reason?: string): Promise<{ message: string; order_number: string }> {
    const response = await axiosInstance.post(`/driver/deliveries/${deliveryId}/accept/`, {
      accepted: false,
      reason:   reason ?? '',
    });
    return response.data;
  },

  async updateLocation(deliveryId: string, latitude: number, longitude: number) {
    const response = await axiosInstance.post(
      `/driver/deliveries/${deliveryId}/location/`,
      { latitude, longitude },
    );
    return response.data;
  },

  async updateStatus(deliveryId: string, newStatus: string, data?: Record<string, unknown>) {
    const response = await axiosInstance.patch(
      `/driver/deliveries/${deliveryId}/status/`,
      { status: newStatus, ...data },
    );
    return response.data;
  },

  async completeDelivery(deliveryId: string, data: FormData) {
    const response = await axiosInstance.post(
      `/driver/deliveries/${deliveryId}/complete/`,
      data,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  },

  // ── Public tracking ───────────────────────────────────────────────────────

  async trackOrder(orderNumber: string) {
    const response = await axiosInstance.get(`/track/${orderNumber}/`);
    return response.data;
  },

  async verifyOTP(deliveryId: string, code: string): Promise<{ message: string; verified: boolean; siblings_verified?: number }> {
    const response = await axiosInstance.post(`/driver/deliveries/${deliveryId}/verify-otp/`, {
      otp_code: code,
    });
    return response.data;
  },

  async resendOTP(deliveryId: string): Promise<{ message: string }> {
    const response = await axiosInstance.post(`/driver/deliveries/${deliveryId}/resend-otp/`);
    return response.data;
  },

  async searchCustomers(q: string): Promise<Array<{
    id: string; name: string; phone: string; email: string;
  }>> {
    const response = await axiosInstance.get('/driver/customers/search/', {
      params: { q },
    });
    return response.data;
  },
};

