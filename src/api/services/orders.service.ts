/**
 * Orders Service
 * Handles all order-related API calls
 */

import axiosInstance from '../axios.config';
import { API_ENDPOINTS } from '../endpoints';
import { Order, OrderStatus } from '@/types/order.types';

export interface CreateOrderRequest {
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  deliveryAddress: string;
  scheduledDate?: string;
  priority?: 'normal' | 'high' | 'urgent';
  notes?: string;
  paymentMethod: 'cash' | 'credit' | 'wallet' | 'loan';
}

export interface UpdateOrderRequest {
  items?: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  deliveryAddress?: string;
  scheduledDate?: string;
  priority?: 'normal' | 'high' | 'urgent';
  notes?: string;
}

export interface OrderFilters {
  status?: OrderStatus;
  customerId?: string;
  driverId?: string;
  startDate?: string;
  endDate?: string;
  priority?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Orders service methods
 */
export const ordersService = {
  /**
   * Get all orders with optional filters
   */
  async getOrders(filters?: OrderFilters): Promise<PaginatedResponse<Order>> {
    const response = await axiosInstance.get<PaginatedResponse<Order>>(
      API_ENDPOINTS.ORDERS.BASE,
      { params: filters }
    );
    return response.data;
  },

  /**
   * Get order by ID
   */
  async getOrderById(id: string): Promise<Order> {
    const response = await axiosInstance.get<Order>(API_ENDPOINTS.ORDERS.BY_ID(id));
    return response.data;
  },

  /**
   * Get orders by client ID
   */
  async getOrdersByClient(
    clientId: string,
    filters?: OrderFilters
  ): Promise<PaginatedResponse<Order>> {
    const response = await axiosInstance.get<PaginatedResponse<Order>>(
      API_ENDPOINTS.ORDERS.BY_CLIENT(clientId),
      { params: filters }
    );
    return response.data;
  },

  /**
   * Get orders by customer ID
   */
  async getOrdersByCustomer(
    customerId: string,
    filters?: OrderFilters
  ): Promise<PaginatedResponse<Order>> {
    const response = await axiosInstance.get<PaginatedResponse<Order>>(
      API_ENDPOINTS.ORDERS.BY_CUSTOMER(customerId),
      { params: filters }
    );
    return response.data;
  },

  /**
   * Get orders by status
   */
  async getOrdersByStatus(
    status: OrderStatus,
    filters?: OrderFilters
  ): Promise<PaginatedResponse<Order>> {
    const response = await axiosInstance.get<PaginatedResponse<Order>>(
      API_ENDPOINTS.ORDERS.BY_STATUS(status),
      { params: filters }
    );
    return response.data;
  },

  /**
   * Create new order
   */
  async createOrder(data: CreateOrderRequest): Promise<Order> {
    const response = await axiosInstance.post<Order>(API_ENDPOINTS.ORDERS.BASE, data);
    return response.data;
  },

  /**
   * Update existing order
   */
  async updateOrder(id: string, data: UpdateOrderRequest): Promise<Order> {
    const response = await axiosInstance.put<Order>(API_ENDPOINTS.ORDERS.BY_ID(id), data);
    return response.data;
  },

  /**
   * Update order status
   */
  async updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    const response = await axiosInstance.patch<Order>(API_ENDPOINTS.ORDERS.UPDATE_STATUS(id), {
      status,
    });
    return response.data;
  },

  /**
   * Delete order
   */
  async deleteOrder(id: string): Promise<void> {
    await axiosInstance.delete(API_ENDPOINTS.ORDERS.BY_ID(id));
  },

  /**
   * Bulk import orders from CSV/Excel
   */
  async bulkImportOrders(file: File): Promise<{ imported: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.post<{ imported: number; errors: string[] }>(
      API_ENDPOINTS.ORDERS.BULK_IMPORT,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data;
  },
};

export default ordersService;
