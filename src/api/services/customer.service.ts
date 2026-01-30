/**
 * Customer Service
 * Handles customer profile and account operations
 */

import axiosInstance from '../axios.config';
import { CUSTOMER_API_ENDPOINTS } from '../customerEndpoints';
import {
  CustomerType,
  CustomerStatus,
  type CustomerAccount,
  type CustomerProfile,
  type CustomerAddress,
  type CustomerPreferences,
  type CustomerNotification,
} from '@/types/customer.types';

export const customerService = {
  // Profile Operations
  async getProfile(): Promise<CustomerProfile> {
    const response = await axiosInstance.get<CustomerProfile>(
      CUSTOMER_API_ENDPOINTS.PROFILE.GET
    );
    return response.data;
  },

  async updateProfile(data: Partial<CustomerProfile>): Promise<CustomerProfile> {
    const response = await axiosInstance.put<CustomerProfile>(
      CUSTOMER_API_ENDPOINTS.PROFILE.UPDATE,
      data
    );
    return response.data;
  },

  // Address Operations
  async getAddresses(): Promise<CustomerAddress[]> {
    const response = await axiosInstance.get<CustomerAddress[]>(
      CUSTOMER_API_ENDPOINTS.PROFILE.ADDRESSES
    );
    return response.data;
  },

  async addAddress(address: Omit<CustomerAddress, 'id'>): Promise<CustomerAddress> {
    const response = await axiosInstance.post<CustomerAddress>(
      CUSTOMER_API_ENDPOINTS.PROFILE.ADDRESSES,
      address
    );
    return response.data;
  },

  async updateAddress(id: string, address: Partial<CustomerAddress>): Promise<CustomerAddress> {
    const response = await axiosInstance.put<CustomerAddress>(
      CUSTOMER_API_ENDPOINTS.PROFILE.ADDRESS_BY_ID(id),
      address
    );
    return response.data;
  },

  async deleteAddress(id: string): Promise<void> {
    await axiosInstance.delete(CUSTOMER_API_ENDPOINTS.PROFILE.ADDRESS_BY_ID(id));
  },

  async setDefaultAddress(id: string): Promise<CustomerAddress> {
    const response = await axiosInstance.put<CustomerAddress>(
      CUSTOMER_API_ENDPOINTS.PROFILE.ADDRESS_BY_ID(id),
      { isDefault: true }
    );
    return response.data;
  },

  // Preferences
  async updatePreferences(preferences: Partial<CustomerPreferences>): Promise<CustomerPreferences> {
    const response = await axiosInstance.put<CustomerPreferences>(
      CUSTOMER_API_ENDPOINTS.PROFILE.PREFERENCES,
      preferences
    );
    return response.data;
  },

  // Notifications
  async getNotifications(): Promise<CustomerNotification[]> {
    const response = await axiosInstance.get<CustomerNotification[]>(
      CUSTOMER_API_ENDPOINTS.NOTIFICATIONS.LIST
    );
    return response.data;
  },

  async markNotificationRead(id: string): Promise<void> {
    await axiosInstance.put(CUSTOMER_API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id));
  },

  async markAllNotificationsRead(): Promise<void> {
    await axiosInstance.put(CUSTOMER_API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ);
  },

  // Support
  async createSupportTicket(data: {
    subject: string;
    message: string;
    category: string;
  }): Promise<{ ticketId: string }> {
    const response = await axiosInstance.post(
      CUSTOMER_API_ENDPOINTS.SUPPORT.CREATE_TICKET,
      data
    );
    return response.data;
  },

  async getFAQ(): Promise<Array<{ question: string; answer: string; category: string }>> {
    const response = await axiosInstance.get(CUSTOMER_API_ENDPOINTS.SUPPORT.FAQ);
    return response.data;
  },
};

// Mock data for development
export const mockCustomerAccount: CustomerAccount = {
  customerId: 'cust-001',
  clientId: 'client-001',
  customerType: CustomerType.REFILL_CUSTOMER,
  personalInfo: {
    fullName: 'Ahmed Mohammed',
    phoneNumber: '+254712345678',
    email: 'ahmed@email.com',
    deliveryAddress: '123 Main Street, Nairobi',
  },
  bottleInventory: {
    totalOwnedBottles: 10,
    fullBottlesInPossession: 3,
    emptyBottlesInPossession: 5,
    bottlesInTransit: 2,
    bottlesAtDistributor: 0,
    lifetimeBottlesPurchased: 15,
    lifetimeBottlesReturned: 5,
  },
  depositAccount: {
    bottleDepositPerUnit: 10,
    totalDepositPaid: 100,
    depositRefundable: true,
    depositRefundConditions: 'Return bottles in good condition',
  },
  preferences: {
    preferredDeliveryTime: '10:00 AM - 12:00 PM',
    deliveryInstructions: 'Call when arriving',
    notificationPreferences: {
      sms: true,
      email: true,
      push: true,
    },
  },
  status: CustomerStatus.ACTIVE,
  registrationDate: '2024-01-15T00:00:00Z',
  lastOrderDate: '2024-01-30T00:00:00Z',
};
