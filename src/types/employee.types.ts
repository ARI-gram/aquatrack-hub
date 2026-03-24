/**
 * Employee Types
 * src/types/employee.types.ts
 */

export type EmployeeRole = 'site_manager' | 'driver' | 'accountant';

export interface Employee {
  id:          string;
  firstName:   string;
  lastName:    string;
  fullName:    string;
  email:       string;
  phone:       string | null;
  role:        EmployeeRole;
  numberPlate: string;   // empty string for non-drivers
  isActive:    boolean;
  isVerified:  boolean;
  lastLogin:   string | null;
  createdAt:   string;
}

export interface CreateEmployeeRequest {
  firstName:    string;
  lastName:     string;
  email:        string;
  phone?:       string;
  role:         EmployeeRole;
  number_plate?: string;  // required when role = 'driver'
}

export interface UpdateEmployeeRequest {
  firstName?:   string;
  lastName?:    string;
  phone?:       string;
  numberPlate?: string;  // driver vehicle plate
}

export interface CreateEmployeeResponse {
  employee:           Employee;
  temporary_password: string;
}

export interface ResetEmployeePasswordResponse {
  employee:           Employee;
  temporary_password: string;
}

export interface EmployeeFilters {
  search?:  string;
  role?:    EmployeeRole;
  status?:  'active' | 'inactive';
  page?:    number;
  limit?:   number;
}

export interface PaginatedEmployees {
  data:        Employee[];
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
}