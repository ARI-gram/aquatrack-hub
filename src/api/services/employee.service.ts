/**
 * Employee Service
 * /src/api/services/employee.service.ts
 *
 * All requests are scoped to the authenticated client admin's company
 * by the backend — no client ID needed in the URL.
 */

import axiosInstance from '../axios.config';
import {
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  CreateEmployeeResponse,
  ResetEmployeePasswordResponse,
  EmployeeFilters,
  PaginatedEmployees,
} from '@/types/employee.types';

const BASE = '/auth/employees/';

export const employeeService = {
  /**
   * List employees with optional filtering + pagination.
   */
  async getEmployees(filters?: EmployeeFilters): Promise<PaginatedEmployees> {
    const response = await axiosInstance.get<PaginatedEmployees>(BASE, {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get a single employee by ID.
   */
  async getEmployee(id: string): Promise<Employee> {
    const response = await axiosInstance.get<Employee>(`${BASE}${id}/`);
    return response.data;
  },

  /**
   * Create a new employee.
   * Response includes the generated temporary_password for the UI dialog.
   */
  async createEmployee(data: CreateEmployeeRequest): Promise<CreateEmployeeResponse> {
    const response = await axiosInstance.post<CreateEmployeeResponse>(BASE, data);
    return response.data;
  },

  /**
   * Update an employee (partial).
   */
  async updateEmployee(id: string, data: UpdateEmployeeRequest): Promise<Employee> {
    const response = await axiosInstance.patch<Employee>(`${BASE}${id}/`, data);
    return response.data;
  },

  /**
   * Deactivate an employee (soft delete — keeps DB record).
   */
  async deactivateEmployee(id: string): Promise<{ message: string; employee: Employee }> {
    const response = await axiosInstance.post<{ message: string; employee: Employee }>(
      `${BASE}${id}/deactivate/`
    );
    return response.data;
  },

  /**
   * Reactivate a previously deactivated employee.
   */
  async reactivateEmployee(id: string): Promise<{ message: string; employee: Employee }> {
    const response = await axiosInstance.post<{ message: string; employee: Employee }>(
      `${BASE}${id}/reactivate/`
    );
    return response.data;
  },

  /**
   * Reset employee password. Returns new temporary_password for the UI dialog.
   */
  async resetPassword(id: string): Promise<ResetEmployeePasswordResponse> {
    const response = await axiosInstance.post<ResetEmployeePasswordResponse>(
      `${BASE}${id}/reset-password/`
    );
    return response.data;
  },
};

export default employeeService;