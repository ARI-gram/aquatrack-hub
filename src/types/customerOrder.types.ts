/**
 * Customer Order Type Definitions
 * Types for customer order placement and tracking
 */

import { PaymentMethod } from './wallet.types';

export enum CustomerOrderStatus {
  DRAFT = 'DRAFT',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  ASSIGNED = 'ASSIGNED',
  IN_TRANSIT = 'IN_TRANSIT',
  NEAR_YOU = 'NEAR_YOU',
  DELIVERED = 'DELIVERED',
  EXCHANGE_PENDING = 'EXCHANGE_PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum OrderType {
  REFILL = 'REFILL',
  NEW_BOTTLE = 'NEW_BOTTLE',
  MIXED = 'MIXED',
}

export interface CustomerOrder {
  orderId: string;
  orderNumber: string;
  customerId: string;
  clientId: string;
  
  orderType: OrderType;
  items: CustomerOrderItem[];
  
  delivery: DeliveryDetails;
  payment: PaymentDetails;
  
  bottles: BottleExchangeDetails;
  
  status: CustomerOrderStatus;
  timeline: OrderTimeline;
  
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerOrderItem {
  itemId: string;
  type: 'REFILL' | 'NEW_BOTTLE';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface DeliveryDetails {
  addressId: string;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  scheduledDate: string;
  scheduledTimeSlot: string;
  estimatedArrival?: string;
  deliveryInstructions?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverPhoto?: string;
  vehicleNumber?: string;
}

export interface PaymentDetails {
  method: PaymentMethod;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  paidAt?: string;
}

export interface BottleExchangeDetails {
  toDeliver: number;
  toCollect: number;
  delivered?: number;
  collected?: number;
  exchangeConfirmed: boolean;
  confirmedAt?: string;
}

export interface OrderTimeline {
  orderPlaced: string;
  confirmed?: string;
  driverAssigned?: string;
  inTransit?: string;
  nearYou?: string;
  delivered?: string;
  exchangeConfirmed?: string;
  completed?: string;
  cancelled?: string;
}

export interface CreateOrderRequest {
  orderType: OrderType;
  items: {
    type: 'REFILL' | 'NEW_BOTTLE';
    quantity: number;
  }[];
  addressId: string;
  scheduledDate: string;
  scheduledTimeSlot: string;
  paymentMethod: PaymentMethod;
  deliveryInstructions?: string;
  notes?: string;
}

export interface DeliveryTimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  available: boolean;
  surcharge?: number;
}

export interface DeliveryTrackingData {
  orderId: string;
  orderNumber: string;
  status: CustomerOrderStatus;
  estimatedArrival?: string;
  driver?: {
    name: string;
    phone: string;
    photo?: string;
    vehicleNumber: string;
    currentLocation?: {
      lat: number;
      lng: number;
    };
  };
  timeline: OrderTimeline;
  bottles: BottleExchangeDetails;
}

export interface OrderSummary {
  orderId: string;
  orderNumber: string;
  orderType: OrderType;
  itemCount: number;
  total: number;
  status: CustomerOrderStatus;
  scheduledDate: string;
  createdAt: string;
}
