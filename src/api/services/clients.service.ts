/**
 * Clients Service
 * Handles all client (distributor) management API calls
 * /src/api/services/clients.service.ts
 */

import axiosInstance from '../axios.config';
import { API_ENDPOINTS } from '../endpoints';
import { User } from '@/types/auth.types';

// ─── Re-exported types ────────────────────────────────────────────────────────

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
export interface CredentialsResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  temporary_password: string;
}
/**
 * Shape returned by POST /api/clients/
 *
 * The Django view returns:
 * {
 *   client:             { ...camelCase Client fields }
 *   user:               { id, email, firstName, lastName, role }
 *   temporary_password: "Xk9mP2qR7abc"
 * }
 *
 * The frontend uses `user.email` and `temporary_password` to display
 * the credentials dialog immediately after creation.
 */
export interface CreateClientResponse {
  client: Client;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  temporary_password: string;
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
  subscriptionPlan?: string;
  subscription_status?: string;
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

// ─── Service ──────────────────────────────────────────────────────────────────

export const clientsService = {
  /**
   * Get all clients with optional filters.
   * Returns paginated { data, total, page, limit, totalPages }.
   */
  async getClients(filters?: ClientFilters): Promise<PaginatedResponse<Client>> {
    const response = await axiosInstance.get<PaginatedResponse<Client>>(
      API_ENDPOINTS.CLIENTS.BASE,
      { params: filters }
    );
    return response.data;
  },

  /**
   * Get client by ID.
   */
  async getClientById(id: string): Promise<Client> {
    const response = await axiosInstance.get<Client>(
      API_ENDPOINTS.CLIENTS.BY_ID(id)
    );
    return response.data;
  },

  /**
   * Get client statistics (orders, deliveries, revenue, etc.).
   */
  async getClientStats(id: string): Promise<ClientStats> {
    const response = await axiosInstance.get<ClientStats>(
      API_ENDPOINTS.CLIENTS.STATS(id)
    );
    return response.data;
  },

  /**
   * Get client employees.
   */
  async getClientEmployees(clientId: string): Promise<User[]> {
    const response = await axiosInstance.get<User[]>(
      API_ENDPOINTS.CLIENTS.EMPLOYEES(clientId)
    );
    return response.data;
  },

  /**
   * Create new client.
   *
   * Returns { client, user, temporary_password } so the caller can
   * immediately surface the generated credentials to the admin.
   *
   * The Django backend also sends the credentials by email, but showing
   * them in the UI means the admin can still share them even if email
   * delivery is delayed.
   */
  async createClient(data: CreateClientRequest): Promise<CreateClientResponse> {
    const response = await axiosInstance.post<CreateClientResponse>(
      API_ENDPOINTS.CLIENTS.BASE,
      data
    );
    return response.data;
  },

  /**
   * Update existing client (full or partial).
   */
  async updateClient(id: string, data: UpdateClientRequest): Promise<Client> {
    const response = await axiosInstance.put<Client>(
      API_ENDPOINTS.CLIENTS.BY_ID(id),
      data
    );
    return response.data;
  },

  /**
   * Soft-delete client (sets status → cancelled on backend).
   */
  async deleteClient(id: string): Promise<void> {
    await axiosInstance.delete(API_ENDPOINTS.CLIENTS.BY_ID(id));
  },

  /**
   * Update client-level settings.
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
   * Upload client logo.
   */
  async uploadLogo(clientId: string, file: File): Promise<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await axiosInstance.post<{ logoUrl: string }>(
      `${API_ENDPOINTS.CLIENTS.BY_ID(clientId)}/logo`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  async resetCredentials(id: string): Promise<CredentialsResponse> {
    const response = await axiosInstance.post<CredentialsResponse>(
      `${API_ENDPOINTS.CLIENTS.BY_ID(id)}reset-credentials/`
    );
    return response.data;
  },
};

export default clientsService;