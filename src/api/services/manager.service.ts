/**
 * Manager Service
 * src/api/services/manager.service.ts
 *
 * Site-manager-scoped endpoints.
 * axiosInstance baseURL is already `/api`, so paths are relative.
 */

import axiosInstance from '../axios.config';

export interface ManagerDriver {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle_number: string;
  status: 'available' | 'on_route' | 'off_duty';
  today_assigned: number;
  today_completed: number;
  today_failed: number;
}

export interface ManagerDriverStats {
  total: number;
  available: number;
  on_route: number;
  off_duty: number;
}

export const managerService = {
  /** All drivers visible to this site manager */
  async getDrivers(params?: {
    status?: string;
    search?: string;
  }): Promise<ManagerDriver[]> {
    const r = await axiosInstance.get<ManagerDriver[]>('/manager/drivers/', { params });
    return Array.isArray(r.data) ? r.data : [];
  },

  /** Quick stats for the driver snapshot widget */
  async getDriverStats(): Promise<ManagerDriverStats> {
    const r = await axiosInstance.get<ManagerDriverStats>('/manager/drivers/stats/');
    return r.data;
  },
};