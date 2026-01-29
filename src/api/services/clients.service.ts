/**
 * Clients Service
 * Handles all client (distributor) management API calls
 */

import axiosInstance from '../axios.config';
import { API_ENDPOINTS } from '../endpoints';
import { User } from '@/types/auth.types';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  logo?: string;
  website?: string;
  subscriptionPlan: string;
  subscriptionStatus: 'active' | 'inactive' | 'trial' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface ClientStats {
  totalOrders: number;
  totalDeliveries: number;
  totalCustomers: number;
  totalEmployees: number;
  monthlyRevenue: number;
  outstandingPayments: number;
}

export interface CreateClientRequest {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  website?: string;
  subscriptionPlan: string;
}

export interface UpdateClientRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  website?: string;
  logo?: string;
}

export interface ClientFilters {
  status?: string;
  search?: string;
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
 * Clients service methods
 */
export const clientsService = {
  /**
   * Get all clients with optional filters
   */
  async getClients(filters?: ClientFilters): Promise<PaginatedResponse<Client>> {
    const response = await axiosInstance.get<PaginatedResponse<Client>>(
      API_ENDPOINTS.CLIENTS.BASE,
      { params: filters }
    );
    return response.data;
  },

  /**
   * Get client by ID
   */
  async getClientById(id: string): Promise<Client> {
    const response = await axiosInstance.get<Client>(API_ENDPOINTS.CLIENTS.BY_ID(id));
    return response.data;
  },

  /**
   * Get client statistics
   */
  async getClientStats(id: string): Promise<ClientStats> {
    const response = await axiosInstance.get<ClientStats>(API_ENDPOINTS.CLIENTS.STATS(id));
    return response.data;
  },

  /**
   * Get client employees
   */
  async getClientEmployees(clientId: string): Promise<User[]> {
    const response = await axiosInstance.get<User[]>(API_ENDPOINTS.CLIENTS.EMPLOYEES(clientId));
    return response.data;
  },

  /**
   * Create new client
   */
  async createClient(data: CreateClientRequest): Promise<Client> {
    const response = await axiosInstance.post<Client>(API_ENDPOINTS.CLIENTS.BASE, data);
    return response.data;
  },

  /**
   * Update existing client
   */
  async updateClient(id: string, data: UpdateClientRequest): Promise<Client> {
    const response = await axiosInstance.put<Client>(API_ENDPOINTS.CLIENTS.BY_ID(id), data);
    return response.data;
  },

  /**
   * Delete client
   */
  async deleteClient(id: string): Promise<void> {
    await axiosInstance.delete(API_ENDPOINTS.CLIENTS.BY_ID(id));
  },

  /**
   * Update client settings
   */
  async updateClientSettings(
    clientId: string,
    settings: Record<string, unknown>
  ): Promise<{ message: string }> {
    const response = await axiosInstance.put<{ message: string }>(
      API_ENDPOINTS.CLIENTS.SETTINGS(clientId),
      settings
    );
    return response.data;
  },

  /**
   * Upload client logo
   */
  async uploadLogo(clientId: string, file: File): Promise<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await axiosInstance.post<{ logoUrl: string }>(
      `${API_ENDPOINTS.CLIENTS.BY_ID(clientId)}/logo`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data;
  },
};

export default clientsService;
