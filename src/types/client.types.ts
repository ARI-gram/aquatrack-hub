/**
 * Client Type Definitions
 * Interfaces for distributor/client management
 */
// /src/types/Client.types.ts
export type SubscriptionStatus = 'active' | 'inactive' | 'trial' | 'cancelled';
export type SubscriptionPlan = 'starter' | 'professional' | 'enterprise';

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
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
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
  subscriptionPlan: SubscriptionPlan;
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
  subscriptionPlan?: SubscriptionPlan;
}

export interface ClientFilters {
  status?: SubscriptionStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedClientsResponse {
  data: Client[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}