/**
 * API Services Index
 * Re-exports all service modules for convenient imports
 */

export { authService } from './auth.service';
export { ordersService } from './orders.service';
export { clientsService } from './clients.service';
export { reportsService } from './reports.service';

// Re-export types
export type {
  LoginResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
} from './auth.service';

export type {
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderFilters,
  PaginatedResponse,
} from './orders.service';

export type {
  Client,
  ClientStats,
  CreateClientRequest,
  UpdateClientRequest,
  ClientFilters,
} from './clients.service';

export type {
  DailyReport,
  WeeklyReport,
  MonthlyReport,
  SalesReport,
  DeliveryReport,
  FinancialReport,
  CustomReportRequest,
  ExportRequest,
} from './reports.service';
