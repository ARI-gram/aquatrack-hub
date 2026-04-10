/**
 * Delivery Service
 * src/api/services/delivery.service.ts
 *
 * NOTE: axiosInstance already has `/api` as its baseURL.
 * All paths here are relative to that — do NOT include a leading `/api`.
 */

import axiosInstance from '../axios.config';
import type {
  DriverDelivery,
  DriverDeliveriesResponse,
  DeliveryDetail,
  ClientDelivery,
  DeliveryStats,
  Driver,
  AssignOrderResult,
  DriverProfile,
  StatusUpdateData,
  CompleteDeliveryRequest,
  CompleteDeliveryResponse,
  AdjustmentLine,
  DeliveryAdjustment,
} from '@/types/delivery.types';

// Re-export for consumers who import from this file
export type {
  DriverDelivery,
  DriverDeliveriesResponse,
  DeliveryDetail,
  ClientDelivery,
  DeliveryStats,
  Driver,
  AssignOrderResult,
  DriverProfile,
  StatusUpdateData,
  CompleteDeliveryRequest,
  CompleteDeliveryResponse,
  AdjustmentLine,
  DeliveryAdjustment,
};

export const deliveryService = {

  // ── Client ────────────────────────────────────────────────────────────────

  async getClientDeliveries(params?: {
    status?:    string;
    driver_id?: string;
    date_from?: string;
    date_to?:   string;
    search?:    string;
    page?:      number;
    limit?:     number;
  }): Promise<{ data: ClientDelivery[]; total: number; page: number; limit: number; total_pages: number }> {
    const response = await axiosInstance.get('/client/deliveries/', { params });
    return response.data;
  },

  async getDeliveryStats(): Promise<DeliveryStats> {
    const response = await axiosInstance.get<DeliveryStats>('/client/deliveries/stats/');
    return response.data;
  },

  async getAvailableDrivers(): Promise<Driver[]> {
    const response = await axiosInstance.get<Driver[]>('/client/drivers/available/');
    return response.data;
  },

  async assignOrderToDriver(
    orderId:          string,
    driverId:         string,
    scheduledDate?:   string,
    scheduledTimeSlot?: string,
  ): Promise<AssignOrderResult> {
    const response = await axiosInstance.post<AssignOrderResult>(
      '/client/orders/assign/',
      {
        order_ids: [orderId],
        driver_id: driverId,
        ...(scheduledDate      ? { scheduled_date:      scheduledDate }      : {}),
        ...(scheduledTimeSlot  ? { scheduled_time_slot: scheduledTimeSlot }  : {}),
      },
    );
    return response.data;
  },

  async assignDeliveries(
    deliveryIds:      string[],
    driverId:         string,
    scheduledDate?:   string,
    scheduledTimeSlot?: string,
  ): Promise<AssignOrderResult> {
    const response = await axiosInstance.post<AssignOrderResult>(
      '/client/deliveries/assign/',
      {
        delivery_ids: deliveryIds,
        driver_id:    driverId,
        ...(scheduledDate      ? { scheduled_date:      scheduledDate }      : {}),
        ...(scheduledTimeSlot  ? { scheduled_time_slot: scheduledTimeSlot }  : {}),
      },
    );
    return response.data;
  },

  // ── Driver ────────────────────────────────────────────────────────────────

  async getDriverDeliveries(date?: string, status?: string): Promise<DriverDeliveriesResponse> {
    const params: Record<string, string> = {};
    if (date)   params.date   = date;
    if (status) params.status = status;
    const response = await axiosInstance.get<DriverDeliveriesResponse>(
      '/driver/deliveries/',
      { params },
    );
    return response.data;
  },

  async getDriverDeliveryDetail(deliveryId: string): Promise<DeliveryDetail> {
    const response = await axiosInstance.get<DeliveryDetail>(
      `/driver/deliveries/${deliveryId}/`,
    );
    return response.data;
  },

  async getDriverProfile(): Promise<DriverProfile> {
    const response = await axiosInstance.get<DriverProfile>('/driver/profile/');
    return response.data;
  },

  async acceptDelivery(
    deliveryId: string,
  ): Promise<{ message: string; status: string; accepted_at: string }> {
    const response = await axiosInstance.post(
      `/driver/deliveries/${deliveryId}/accept/`,
      { accepted: true },
    );
    return response.data;
  },

  async declineDelivery(
    deliveryId: string,
    reason?:    string,
  ): Promise<{ message: string; order_number: string }> {
    const response = await axiosInstance.post(
      `/driver/deliveries/${deliveryId}/accept/`,
      { accepted: false, reason: reason ?? '' },
    );
    return response.data;
  },

  async updateLocation(
    deliveryId: string,
    latitude:   number,
    longitude:  number,
  ): Promise<{ message: string; timestamp: string }> {
    const response = await axiosInstance.post(
      `/driver/deliveries/${deliveryId}/location/`,
      { latitude, longitude },
    );
    return response.data;
  },

  async updateStatus(
    deliveryId: string,
    newStatus:  string,
    data?:      Record<string, unknown>,
  ): Promise<{ message: string; status: string; timestamp: string }> {
    const response = await axiosInstance.patch(
      `/driver/deliveries/${deliveryId}/status/`,
      { status: newStatus, ...data },
    );
    return response.data;
  },

  /**
   * Complete a delivery.
   *
   * Pass `delivered_items` for accurate per-item shortfall tracking.
   * The backend will automatically adjust the invoice and order total
   * when any item's qty_delivered is less than ordered.
   *
   * `signature_image` / `photo_proof` are optional File objects.
   * When present the request is sent as multipart/form-data;
   * otherwise as JSON.
   *
   * The response always includes `delivery_adjustment`.
   * Check `delivery_adjustment.applied === true` to know if a deduction
   * was made, then use `delivery_adjustment.lines` to show the driver
   * exactly what was deducted and why.
   *
   * @example — partial delivery
   * ```ts
   * const result = await deliveryService.completeDelivery(id, {
   *   customer_name_confirmed: 'Jane Doe',
   *   delivered_items: [
   *     { order_item_id: 'uuid-1', qty_delivered: 1 }, // ordered 3, only 1 delivered
   *     { order_item_id: 'uuid-2', qty_delivered: 2 }, // fully delivered
   *   ],
   * });
   *
   * if (result.delivery_adjustment.applied) {
   *   const summary = formatAdjustmentSummary(result);
   *   toast.warning(summary); // show driver what was deducted
   * }
   * ```
   */
  async completeDelivery(
    deliveryId: string,
    payload:    CompleteDeliveryRequest & {
      signature_image?: File;
      photo_proof?:     File;
    },
  ): Promise<CompleteDeliveryResponse> {
    const { signature_image, photo_proof, ...rest } = payload;

    // No images → send as JSON (simpler, faster)
    if (!signature_image && !photo_proof) {
      const { data } = await axiosInstance.post<CompleteDeliveryResponse>(
        `/driver/deliveries/${deliveryId}/complete/`,
        rest,
      );
      return data;
    }

    // Images present → multipart/form-data
    const form = new FormData();

    if (rest.customer_name_confirmed !== undefined)
      form.append('customer_name_confirmed', rest.customer_name_confirmed);
    if (rest.driver_notes !== undefined)
      form.append('driver_notes', rest.driver_notes);
    if (rest.customer_rating !== undefined)
      form.append('customer_rating', String(rest.customer_rating));
    if (rest.customer_feedback !== undefined)
      form.append('customer_feedback', rest.customer_feedback);
    if (rest.bottles_delivered !== undefined)
      form.append('bottles_delivered', String(rest.bottles_delivered));
    if (rest.bottles_collected !== undefined)
      form.append('bottles_collected', String(rest.bottles_collected));
    if (rest.amount_collected !== undefined)
      form.append('amount_collected', String(rest.amount_collected));
    if (rest.payment_method_collected !== undefined)
      form.append('payment_method_collected', rest.payment_method_collected);
    if (rest.delivered_items?.length)
      form.append('delivered_items', JSON.stringify(rest.delivered_items));

    if (signature_image) form.append('signature_image', signature_image);
    if (photo_proof)     form.append('photo_proof',     photo_proof);

    const { data } = await axiosInstance.post<CompleteDeliveryResponse>(
      `/driver/deliveries/${deliveryId}/complete/`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  // ── OTP ───────────────────────────────────────────────────────────────────

  async verifyOTP(
    deliveryId: string,
    code:       string,
  ): Promise<{ message: string; verified: boolean; siblings_verified?: number }> {
    const response = await axiosInstance.post(
      `/driver/deliveries/${deliveryId}/verify-otp/`,
      { otp_code: code },
    );
    return response.data;
  },

  async resendOTP(deliveryId: string): Promise<{ message: string }> {
    const response = await axiosInstance.post(
      `/driver/deliveries/${deliveryId}/resend-otp/`,
    );
    return response.data;
  },

  // ── Customer search ───────────────────────────────────────────────────────

  async searchCustomers(q: string): Promise<Array<{
    id: string; name: string; phone: string; email: string;
  }>> {
    const response = await axiosInstance.get('/driver/customers/search/', {
      params: { q },
    });
    return response.data;
  },

  // ── Public tracking ───────────────────────────────────────────────────────

  async trackOrder(orderNumber: string) {
    const response = await axiosInstance.get(`/track/${orderNumber}/`);
    return response.data;
  },
};

// ── Utility: format adjustment summary for UI display ─────────────────────────

/**
 * Converts a CompleteDeliveryResponse into a human-readable string
 * suitable for a toast / alert in the driver completion screen.
 *
 * Returns null when no adjustment was applied (full delivery).
 */
export function formatAdjustmentSummary(
  response: CompleteDeliveryResponse,
): string | null {
  const adj = response.delivery_adjustment;
  if (!adj?.applied || !adj.lines?.length) return null;

  const fmt = (n: number) =>
    n.toLocaleString('en-KE', { minimumFractionDigits: 2 });

  const lines = adj.lines.map(
    (l) =>
      `• ${l.product_name}: delivered ${l.delivered_qty}/${l.ordered_qty} ` +
      `(−KES ${fmt(l.deducted_amt)})`,
  );

  return [
    `Invoice adjusted: −KES ${fmt(adj.total_deducted!)}`,
    ...lines,
    `New total: KES ${fmt(adj.adjusted_amount!)}`,
  ].join('\n');
}