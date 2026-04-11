import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ROUTES, roleDefaultRoutes } from "@/constants/routes";
import { CUSTOMER_ROUTES } from "@/constants/customerRoutes";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

// Auth Pages
import { LoginPage } from "@/pages/auth/LoginPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import NotFound from "@/pages/NotFound";

// Super Admin Pages
import { SuperAdminDashboard } from "@/pages/superadmin/SuperAdminDashboard";
import ClientManagementPage from "@/pages/superadmin/ClientManagementPage";
import BillingPlansPage from "@/pages/superadmin/BillingPlansPage";
import SystemSettingsPage from "@/pages/superadmin/SystemSettingsPage";
import AuditLogsPage from "@/pages/superadmin/AuditLogsPage";

// Client Admin Pages
import { ClientAdminDashboard } from "@/pages/client/ClientAdminDashboard";
import { OrdersPage } from "@/pages/client/OrdersPage";
import { DeliveriesPage } from "@/pages/client/DeliveriesPage";
import { CustomersPage } from "@/pages/client/CustomersPage";
import { CustomerDetailPage } from "@/pages/client/CustomerDetailPage";
import InvoicesPage from "@/pages/client/InvoicesPage";
import ProductsPage from "./pages/client/ProductsPage";
import ClientReportsPage from "@/pages/client/ReportsPage";
import EmployeesPage from "@/pages/client/EmployeesPage";
import ClientSettingsPage from "@/pages/client/SettingsPage";
import StorePage from "@/pages/client/StorePage";
import DirectSalesPage from '@/pages/client/DirectSalesPage';

// Accounts Pages
import AccountantDashboard from '@/pages/accounts/AccountantDashboard';
import AccountingSettingsPage  from '@/pages/accounts/AccountingSettingsPage';
import CustomerStatementPage   from '@/pages/accounts/CustomerStatementPage';
import AccountantCustomersPage from '@/pages/accounts/AccountantCustomersPage';
import AccountsReportsPage     from '@/pages/accounts/ReportsPage';
import InvoicesListPage        from '@/pages/accounts/InvoicesListPage';
import InvoiceDetailPage       from '@/pages/accounts/InvoiceDetailPage';
import AccountingDirectSalesPage from "@/pages/accounts/DirectSalesPage";
import BottleAuditPage         from "@/pages/accounts/BottleAuditPage";

// Site Manager Pages
import { SiteManagerDashboard } from "@/pages/manager/SiteManagerDashboard";
import { DriversPage } from "@/pages/manager/DriversPage";

// Driver Pages
import { DriverDashboard } from "@/pages/driver/DriverDashboard";
import DeliveryQueuePage from "@/pages/driver/DeliveryQueuePage";
import DeliveryDetailPage from "@/pages/driver/DeliveryDetailPage";
import DriverHistoryPage from "@/pages/driver/DriverHistoryPage";
import DriverMapPage from "@/pages/driver/DriverMapPage";
import DriverProfilePage from "@/pages/driver/DriverProfilePage";
import DriverSettingsPage from "@/pages/driver/DriverSettingsPage";
import DriverStorePage from "@/pages/driver/DriverStorePage";
import DriverSalesPage from '@/pages/driver/DriverSalesPage';
import DriverReceiptsPage from '@/pages/driver/DriverReceiptsPage';

// Customer Pages
import CustomerDashboard from "@/pages/customer/CustomerDashboard";
import PlaceOrderPage from "@/pages/customer/PlaceOrderPage";
import OrderHistoryPage from "@/pages/customer/OrderHistoryPage";
import WalletPage from "@/pages/customer/WalletPage";
import CustomerLoginPage from "@/pages/customer/auth/CustomerLoginPage";
import CustomerRegisterPage from "@/pages/customer/auth/CustomerRegisterPage";
import CustomerJoinPage from "@/pages/customer/auth/CustomerJoinPage";
import ProfilePage from "@/pages/customer/ProfilePage";
import AddressesPage from "@/pages/customer/AddressesPage";
import NotificationsPage from "@/pages/customer/NotificationsPage";
import SupportPage from "@/pages/customer/SupportPage";
import BottlesPage from "@/pages/customer/BottlesPage";
import PaymentProfilePage from "@/pages/customer/Paymentprofilepage";
import OrderTrackingPage from "@/pages/customer/OrderTrackingPage";

// Shared notifications page (all roles)
import SharedNotificationsPage from "@/pages/NotificationsPage";
import ManagerReportsPage from "./pages/manager/ReportsPage";

const queryClient = new QueryClient();

const RootRedirect = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return <Navigate to={ROUTES.LOGIN} replace />;
  if (user.role === 'accountant') return <Navigate to="/client/accounts/dashboard" replace />;
  return <Navigate to={roleDefaultRoutes[user.role]} replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<RootRedirect />} />

    {/* ── Public staff auth ── */}
    <Route path={ROUTES.LOGIN}           element={<LoginPage />} />
    <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
    <Route path={ROUTES.RESET_PASSWORD}  element={<ResetPasswordPage />} />  {/* ← missing */}
    <Route path="/unauthorized"          element={<UnauthorizedPage />} />

    {/* ── Customer public auth ── */}
    <Route path={CUSTOMER_ROUTES.LOGIN}    element={<CustomerLoginPage />} />
    <Route path={CUSTOMER_ROUTES.REGISTER} element={<CustomerRegisterPage />} />
    <Route path="/join/:token"             element={<CustomerJoinPage />} />

    {/* ── Shared notifications — all authenticated staff roles ── */}
    <Route element={<ProtectedRoute allowedRoles={['super_admin', 'client_admin', 'site_manager', 'driver', 'customer']} />}>
      <Route path="/notifications" element={<SharedNotificationsPage />} />
    </Route>

    {/* ── Super Admin ── */}
    <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
      <Route path={ROUTES.SUPER_ADMIN.DASHBOARD}  element={<SuperAdminDashboard />} />
      <Route path={ROUTES.SUPER_ADMIN.CLIENTS}    element={<ClientManagementPage />} />
      <Route path={ROUTES.SUPER_ADMIN.BILLING}    element={<BillingPlansPage />} />
      <Route path={ROUTES.SUPER_ADMIN.SETTINGS}   element={<SystemSettingsPage />} />
      <Route path={ROUTES.SUPER_ADMIN.AUDIT_LOGS} element={<AuditLogsPage />} />
    </Route>

    {/* ── Client Admin ── */}
    <Route element={<ProtectedRoute allowedRoles={['client_admin']} />}>
      <Route path={ROUTES.CLIENT_ADMIN.DASHBOARD}  element={<ClientAdminDashboard />} />
      <Route path={ROUTES.CLIENT_ADMIN.ORDERS}     element={<OrdersPage />} />
      <Route path={ROUTES.CLIENT_ADMIN.DELIVERIES} element={<DeliveriesPage />} />
      <Route path={ROUTES.CLIENT_ADMIN.CUSTOMERS}  element={<CustomersPage />} />
      <Route path={ROUTES.CLIENT_ADMIN.STORE}      element={<StorePage />} />
      <Route path="/customers/:id"                  element={<CustomerDetailPage />} />
      <Route path={ROUTES.CLIENT_ADMIN.INVOICES}   element={<InvoicesPage />} />
      <Route path={ROUTES.CLIENT_ADMIN.PRODUCTS}   element={<ProductsPage />} />
      <Route path={ROUTES.CLIENT_ADMIN.REPORTS}    element={<ClientReportsPage />} />
      <Route path={ROUTES.CLIENT_ADMIN.EMPLOYEES}  element={<EmployeesPage />} />
      <Route path={ROUTES.CLIENT_ADMIN.SETTINGS}   element={<ClientSettingsPage />} />
      <Route path="/client/direct-sales"            element={<DirectSalesPage />} />
    </Route>

    {/* ── Accounts module ─────────────────────────────────────────────────────
        Single block for client_admin + accountant + super_admin.
        AccountsLayout inside each page automatically switches between
        DashboardLayout (client_admin) and AccountantLayout (accountant).
        ── */}
    <Route element={<ProtectedRoute allowedRoles={['client_admin', 'accountant', 'super_admin']} />}>
      <Route path="/client/accounts/dashboard" element={<AccountantDashboard />} />
      <Route path="/client/accounts/invoices"                element={<InvoicesListPage />} />
      <Route path="/client/accounts/invoices/:id"            element={<InvoiceDetailPage />} />
      <Route path="/client/accounts/reports"                 element={<AccountsReportsPage />} />
      <Route path="/client/accounts/settings"                element={<AccountingSettingsPage />} />
      <Route path="/client/accounts/customers"               element={<AccountantCustomersPage />} />
      <Route path="/client/accounts/customers/:id/statement" element={<CustomerStatementPage />} />
      <Route path="/client/accounts/direct-sales"            element={<AccountingDirectSalesPage />} />
      <Route path="/client/accounts/bottle-audit"            element={<BottleAuditPage />} />
    </Route>

    {/* ── Site Manager ── */}
    <Route element={<ProtectedRoute allowedRoles={['site_manager', 'client_admin', 'super_admin']} />}>
      <Route path={ROUTES.SITE_MANAGER.DASHBOARD}    element={<SiteManagerDashboard />} />
      <Route path={ROUTES.SITE_MANAGER.ORDERS}       element={<OrdersPage       layout="manager" canCancel={false} />} />
      <Route path={ROUTES.SITE_MANAGER.DELIVERIES}   element={<DeliveriesPage   layout="manager" />} />
      <Route path={ROUTES.SITE_MANAGER.DRIVERS}      element={<DriversPage />} />   {/* ← add this */}
      <Route path={ROUTES.SITE_MANAGER.STOCK}        element={<StorePage        layout="manager" />} />
      <Route path={ROUTES.SITE_MANAGER.DIRECT_SALES} element={<DirectSalesPage  layout="manager" />} />
      <Route path={ROUTES.SITE_MANAGER.REPORTS}      element={<ManagerReportsPage />} />
    </Route>

    {/* ── Driver ── */}
    <Route element={<ProtectedRoute allowedRoles={['driver', 'site_manager', 'client_admin', 'super_admin']} />}>
      <Route path={ROUTES.DRIVER.DASHBOARD}       element={<DriverDashboard />} />
      <Route path={ROUTES.DRIVER.DELIVERIES}      element={<DeliveryQueuePage />} />
      <Route path={ROUTES.DRIVER.DELIVERY_DETAIL} element={<DeliveryDetailPage />} />
      <Route path={ROUTES.DRIVER.STORE}           element={<DriverStorePage />} />
      <Route path="/driver/history"               element={<DriverHistoryPage />} />
      <Route path="/driver/map"                   element={<DriverMapPage />} />
      <Route path="/driver/profile"               element={<DriverProfilePage />} />
      <Route path="/driver/settings"              element={<DriverSettingsPage />} />
      <Route path="/driver/sales"                 element={<DriverSalesPage />} />
      <Route path="/driver/receipts"              element={<DriverReceiptsPage />} /> 
    </Route>

    {/* ── Customer ── */}
    <Route element={<ProtectedRoute allowedRoles={['customer']} customerOnly />}>
      <Route path={CUSTOMER_ROUTES.DASHBOARD}       element={<CustomerDashboard />} />
      <Route path={CUSTOMER_ROUTES.PLACE_ORDER}     element={<PlaceOrderPage />} />
      <Route path={CUSTOMER_ROUTES.ORDER_HISTORY}   element={<OrderHistoryPage />} />
      <Route path={CUSTOMER_ROUTES.WALLET}          element={<WalletPage />} />
      <Route path={CUSTOMER_ROUTES.BOTTLES}         element={<BottlesPage />} />
      <Route path={CUSTOMER_ROUTES.PROFILE}         element={<ProfilePage />} />
      <Route path={CUSTOMER_ROUTES.ADDRESSES}       element={<AddressesPage />} />
      <Route path={CUSTOMER_ROUTES.NOTIFICATIONS}   element={<NotificationsPage />} />
      <Route path={CUSTOMER_ROUTES.SUPPORT}         element={<SupportPage />} />
      <Route path={CUSTOMER_ROUTES.PAYMENT_PROFILE} element={<PaymentProfilePage />} />
      <Route path={CUSTOMER_ROUTES.ORDER_TRACK}     element={<OrderTrackingPage />} />
    </Route>

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;