/**
 * Delivery Tracking Service
 * Real-time tracking for customer deliveries
 */

import axiosInstance from '../axios.config';
import { CUSTOMER_API_ENDPOINTS } from '../customerEndpoints';
import { CustomerOrderStatus } from '@/types/customerOrder.types';
import type { DeliveryTrackingData } from '@/types/customerOrder.types';

export interface DriverLocation {
  lat: number;
  lng: number;
  timestamp: string;
  heading?: number;
  speed?: number;
}

export interface ETAUpdate {
  estimatedArrival: string;
  remainingMinutes: number;
  distanceKm: number;
}

export const trackingService = {
  /**
   * Get current tracking data for an order
   */
  async getTrackingData(orderId: string): Promise<DeliveryTrackingData> {
    const response = await axiosInstance.get<DeliveryTrackingData>(
      CUSTOMER_API_ENDPOINTS.ORDERS.TRACK(orderId)
    );
    return response.data;
  },

  /**
   * Subscribe to real-time location updates (placeholder for WebSocket)
   */
  subscribeToLocationUpdates(
    orderId: string,
    onUpdate: (location: DriverLocation) => void
  ): () => void {
    // In production, this would establish a WebSocket connection
    // For now, we simulate with polling
    const interval = setInterval(async () => {
      try {
        const data = await this.getTrackingData(orderId);
        if (data.driver?.currentLocation) {
          onUpdate({
            ...data.driver.currentLocation,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Failed to fetch location update:', error);
      }
    }, 30000); // Poll every 30 seconds

    // Return unsubscribe function
    return () => clearInterval(interval);
  },

  /**
   * Subscribe to status updates (placeholder for WebSocket)
   */
  subscribeToStatusUpdates(
    orderId: string,
    onUpdate: (status: CustomerOrderStatus) => void
  ): () => void {
    // In production, this would use WebSocket or Server-Sent Events
    const interval = setInterval(async () => {
      try {
        const data = await this.getTrackingData(orderId);
        onUpdate(data.status);
      } catch (error) {
        console.error('Failed to fetch status update:', error);
      }
    }, 60000); // Poll every 60 seconds

    return () => clearInterval(interval);
  },

  /**
   * Get ETA for delivery
   */
  async getETA(orderId: string): Promise<ETAUpdate> {
    // This would call a route optimization API in production
    const data = await this.getTrackingData(orderId);
    
    if (data.estimatedArrival) {
      const eta = new Date(data.estimatedArrival);
      const now = new Date();
      const remainingMinutes = Math.max(0, Math.floor((eta.getTime() - now.getTime()) / 60000));
      
      return {
        estimatedArrival: data.estimatedArrival,
        remainingMinutes,
        distanceKm: remainingMinutes * 0.5, // Rough estimate
      };
    }
    
    return {
      estimatedArrival: '',
      remainingMinutes: 0,
      distanceKm: 0,
    };
  },
};

// Mock tracking data
export const mockTrackingData: DeliveryTrackingData = {
  orderId: 'ord-045',
  orderNumber: 'ORD-2024-045',
  status: CustomerOrderStatus.IN_TRANSIT,
  estimatedArrival: new Date(Date.now() + 12 * 60000).toISOString(), // 12 mins from now
  driver: {
    name: 'Hassan',
    phone: '+254700000000',
    photo: undefined,
    vehicleNumber: 'KBX 123A',
    currentLocation: {
      lat: -1.2921,
      lng: 36.8219,
    },
  },
  timeline: {
    orderPlaced: '2024-01-30T09:00:00Z',
    confirmed: '2024-01-30T09:15:00Z',
    driverAssigned: '2024-01-31T08:00:00Z',
    inTransit: '2024-01-31T09:30:00Z',
  },
  bottles: {
    toDeliver: 5,
    toCollect: 5,
    exchangeConfirmed: false,
  },
};
