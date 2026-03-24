/**
 * Customer Portal Type Definitions
 * Types for customer accounts, profiles, and preferences
 */
// /src/types/customer.types.ts
export enum CustomerType {
  REFILL_CUSTOMER = 'REFILL',
  ONETIME_CUSTOMER = 'ONETIME',
  HYBRID_CUSTOMER = 'HYBRID',
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BLOCKED = 'BLOCKED',
}

export interface CustomerPersonalInfo {
  fullName: string;
  phoneNumber: string;
  email?: string;
  deliveryAddress: string;
  alternateAddresses?: CustomerAddress[];
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface CustomerAddress {
  id: string;
  label: string;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  isDefault: boolean;
  deliveryInstructions?: string;
}

export interface CustomerBottleInventory {
  totalOwnedBottles: number;
  fullBottlesInPossession: number;
  emptyBottlesInPossession: number;
  bottlesInTransit: number;
  bottlesAtDistributor: number;
  lifetimeBottlesPurchased: number;
  lifetimeBottlesReturned: number;
}

export interface CustomerDepositAccount {
  bottleDepositPerUnit: number;
  totalDepositPaid: number;
  depositRefundable: boolean;
  depositRefundConditions: string;
}

export interface CustomerPreferences {
  preferredDeliveryTime: string;
  deliveryInstructions: string;
  notificationPreferences: {
    sms: boolean;
    email: boolean;
    push: boolean;
  };
}

export interface CustomerAccount {
  customerId: string;
  clientId: string;
  customerType: CustomerType;
  personalInfo: CustomerPersonalInfo;
  bottleInventory: CustomerBottleInventory;
  depositAccount: CustomerDepositAccount;
  preferences: CustomerPreferences;
  status: CustomerStatus;
  registrationDate: string;
  lastOrderDate?: string;
}

export interface CustomerRegistrationData {
  phoneNumber: string;
  otp?: string;
  fullName: string;
  email?: string;
  deliveryAddress: string;
  customerType: CustomerType;
  initialBottleQuantity?: number;
  preferredPaymentMethod: 'WALLET' | 'CASH' | 'CREDIT_ACCOUNT';
  initialWalletTopUp?: number;
  termsAccepted: boolean;
}

export interface CustomerLoginData {
  phoneNumber: string;
  otp: string;
}

export interface CustomerProfile {
  customerId: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  customerType: CustomerType;
  status: CustomerStatus;
  addresses: CustomerAddress[];
  preferences: CustomerPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerNotification {
  notificationId: string;
  customerId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  actionText?: string;
  read: boolean;
  timestamp: string;
}

export enum NotificationType {
  ORDER_CONFIRMED = 'ORDER_CONFIRMED',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  DRIVER_NEARBY = 'DRIVER_NEARBY',
  DELIVERY_COMPLETED = 'DELIVERY_COMPLETED',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  WALLET_LOW_BALANCE = 'WALLET_LOW_BALANCE',
  PROMOTION = 'PROMOTION',
  REMINDER = 'REMINDER',
}
