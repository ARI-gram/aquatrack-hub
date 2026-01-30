/**
 * Customer Order Service
 * Handles order placement and tracking for customers
 */

import axiosInstance from '../axios.config';
import { CUSTOMER_API_ENDPOINTS } from '../customerEndpoints';
import {
  CustomerOrderStatus,
  OrderType,
  type CustomerOrder,
  type CreateOrderRequest,
  type DeliveryTrackingData,
  type OrderSummary,
  type DeliveryTimeSlot,
} from '@/types/customerOrder.types';
import { PaymentMethod } from '@/types/wallet.types';

export const customerOrderService = {
  /**
   * Get list of customer orders
   */
  async getOrders(params?: {
    page?: number;
    limit?: number;
    status?: CustomerOrderStatus;
    startDate?: string;
    endDate?: string;
  }): Promise<{ orders: OrderSummary[]; total: number }> {
    const response = await axiosInstance.get(
      CUSTOMER_API_ENDPOINTS.ORDERS.LIST,
      { params }
    );
    return response.data;
  },

  /**
   * Get active orders
   */
  async getActiveOrders(): Promise<CustomerOrder[]> {
    const response = await axiosInstance.get<CustomerOrder[]>(
      CUSTOMER_API_ENDPOINTS.ORDERS.ACTIVE
    );
    return response.data;
  },

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<CustomerOrder> {
    const response = await axiosInstance.get<CustomerOrder>(
      CUSTOMER_API_ENDPOINTS.ORDERS.BY_ID(orderId)
    );
    return response.data;
  },

  /**
   * Create new order
   */
  async createOrder(request: CreateOrderRequest): Promise<CustomerOrder> {
    const response = await axiosInstance.post<CustomerOrder>(
      CUSTOMER_API_ENDPOINTS.ORDERS.CREATE,
      request
    );
    return response.data;
  },

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, reason?: string): Promise<{ success: boolean }> {
    const response = await axiosInstance.put(
      CUSTOMER_API_ENDPOINTS.ORDERS.CANCEL(orderId),
      { reason }
    );
    return response.data;
  },

  /**
   * Track order
   */
  async trackOrder(orderId: string): Promise<DeliveryTrackingData> {
    const response = await axiosInstance.get<DeliveryTrackingData>(
      CUSTOMER_API_ENDPOINTS.ORDERS.TRACK(orderId)
    );
    return response.data;
  },

  /**
   * Confirm delivery and bottle exchange
   */
  async confirmDelivery(
    orderId: string,
    data: {
      deliveredBottles: number;
      collectedBottles: number;
      signature?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean }> {
    const response = await axiosInstance.post(
      CUSTOMER_API_ENDPOINTS.ORDERS.CONFIRM_DELIVERY(orderId),
      data
    );
    return response.data;
  },

  /**
   * Get available delivery time slots
   */
  async getTimeSlots(date: string): Promise<DeliveryTimeSlot[]> {
    const response = await axiosInstance.get<DeliveryTimeSlot[]>(
      CUSTOMER_API_ENDPOINTS.PRICING.TIME_SLOTS,
      { params: { date } }
    );
    return response.data;
  },
};

// Mock data for development
export const mockActiveOrder: CustomerOrder = {
  orderId: 'ord-045',
  orderNumber: 'ORD-2024-045',
  customerId: 'cust-001',
  clientId: 'client-001',
  orderType: OrderType.REFILL,
  items: [
    {
      itemId: 'item-001',
      type: 'REFILL',
      quantity: 5,
      unitPrice: 3.00,
      totalPrice: 15.00,
    },
  ],
  delivery: {
    addressId: 'addr-001',
    address: '123 Main Street, Nairobi',
    scheduledDate: '2024-01-31',
    scheduledTimeSlot: '10:00 AM - 12:00 PM',
    estimatedArrival: '2024-01-31T10:30:00Z',
    driverId: 'driver-001',
    driverName: 'Hassan',
    driverPhone: '+254700000000',
    vehicleNumber: 'KBX 123A',
  },
  payment: {
    method: PaymentMethod.WALLET,
    subtotal: 15.00,
    deliveryFee: 2.00,
    discount: 0,
    total: 17.00,
    status: 'PAID',
    paidAt: '2024-01-30T09:00:00Z',
  },
  bottles: {
    toDeliver: 5,
    toCollect: 5,
    exchangeConfirmed: false,
  },
  status: CustomerOrderStatus.IN_TRANSIT,
  timeline: {
    orderPlaced: '2024-01-30T09:00:00Z',
    confirmed: '2024-01-30T09:15:00Z',
    driverAssigned: '2024-01-31T08:00:00Z',
    inTransit: '2024-01-31T09:30:00Z',
  },
  createdAt: '2024-01-30T09:00:00Z',
  updatedAt: '2024-01-31T09:30:00Z',
};

export const mockOrderHistory: OrderSummary[] = [
  {
    orderId: 'ord-045',
    orderNumber: 'ORD-2024-045',
    orderType: OrderType.REFILL,
    itemCount: 5,
    total: 17.00,
    status: CustomerOrderStatus.IN_TRANSIT,
    scheduledDate: '2024-01-31',
    createdAt: '2024-01-30T09:00:00Z',
  },
  {
    orderId: 'ord-042',
    orderNumber: 'ORD-2024-042',
    orderType: OrderType.REFILL,
    itemCount: 3,
    total: 11.00,
    status: CustomerOrderStatus.COMPLETED,
    scheduledDate: '2024-01-28',
    createdAt: '2024-01-27T14:00:00Z',
  },
  {
    orderId: 'ord-038',
    orderNumber: 'ORD-2024-038',
    orderType: OrderType.NEW_BOTTLE,
    itemCount: 2,
    total: 18.00,
    status: CustomerOrderStatus.COMPLETED,
    scheduledDate: '2024-01-25',
    createdAt: '2024-01-24T11:00:00Z',
  },
];
