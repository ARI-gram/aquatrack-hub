/**
 * Customer Authentication Service
 * Handles customer-specific authentication flows
 */

import axiosInstance from '../axios.config';
import { CUSTOMER_API_ENDPOINTS } from '../customerEndpoints';
import type { CustomerRegistrationData, CustomerLoginData } from '@/types/customer.types';

export interface OTPResponse {
  success: boolean;
  message: string;
  expiresIn: number;
}

export interface CustomerAuthResponse {
  success: boolean;
  token: string;
  refreshToken: string;
  customer: {
    customerId: string;
    fullName: string;
    phoneNumber: string;
    customerType: string;
  };
}

export const customerAuthService = {
  /**
   * Send OTP to phone number
   */
  async sendOTP(phoneNumber: string): Promise<OTPResponse> {
    const response = await axiosInstance.post<OTPResponse>(
      CUSTOMER_API_ENDPOINTS.AUTH.SEND_OTP,
      { phoneNumber }
    );
    return response.data;
  },

  /**
   * Verify OTP
   */
  async verifyOTP(phoneNumber: string, otp: string): Promise<{ verified: boolean }> {
    const response = await axiosInstance.post(
      CUSTOMER_API_ENDPOINTS.AUTH.VERIFY_OTP,
      { phoneNumber, otp }
    );
    return response.data;
  },

  /**
   * Register new customer
   */
  async register(data: CustomerRegistrationData): Promise<CustomerAuthResponse> {
    const response = await axiosInstance.post<CustomerAuthResponse>(
      CUSTOMER_API_ENDPOINTS.AUTH.REGISTER,
      data
    );
    return response.data;
  },

  /**
   * Login with phone number and OTP
   */
  async login(data: CustomerLoginData): Promise<CustomerAuthResponse> {
    const response = await axiosInstance.post<CustomerAuthResponse>(
      CUSTOMER_API_ENDPOINTS.AUTH.LOGIN,
      data
    );
    return response.data;
  },

  /**
   * Logout customer
   */
  async logout(): Promise<void> {
    await axiosInstance.post(CUSTOMER_API_ENDPOINTS.AUTH.LOGOUT);
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_data');
  },

  /**
   * Refresh authentication token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    const response = await axiosInstance.post(
      CUSTOMER_API_ENDPOINTS.AUTH.REFRESH_TOKEN,
      { refreshToken }
    );
    return response.data;
  },

  /**
   * Check if customer is authenticated
   */
  isAuthenticated(): boolean {
    return !!localStorage.getItem('customer_token');
  },

  /**
   * Get stored customer data
   */
  getStoredCustomer(): CustomerAuthResponse['customer'] | null {
    const data = localStorage.getItem('customer_data');
    return data ? JSON.parse(data) : null;
  },

  /**
   * Store authentication data
   */
  storeAuthData(authResponse: CustomerAuthResponse): void {
    localStorage.setItem('customer_token', authResponse.token);
    localStorage.setItem('customer_data', JSON.stringify(authResponse.customer));
  },
};
