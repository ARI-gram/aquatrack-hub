/**
 * Employees Page
 * Role: Client Admin
 * Route: /client/employees
 *
 * Supports roles: site_manager, driver, accountant
 * Mobile: card list | Desktop: data table
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Plus, MoreHorizontal, Users, UserCheck,
  Truck, Building2, Loader2, UserX, UserCog,
  RefreshCw, Car, Calculator,
} from 'lucide-react';

import { CredentialsDialog }  from '@/components/dialogs/CredentialsDialog';
import { AddEmployeeDialog }  from '@/components/dialogs/AddEmployeeDialog';
import { EditEmployeeDialog } from '@/components/dialogs/EditEmployeeDialog';
import { ConfirmDialog }      from '@/components/dialogs/ConfirmDialog';

import { employeeService }    from '@/api/services/employee.service';
import type { Employee, EmployeeRole } from '@/types/employee.types';

// ── Role badge ────────────────────────────────────────────────────────────────

const RoleBadge: React.FC<{ role: EmployeeRole }> = ({ role }) => {
  switch (role) {
    case 'site_manager':
      return (
        <Badge variant="info" className="flex w-fit items-center gap-1 text-xs">
          <Building2 className="h-3 w-3" /> Site Manager
        </Badge>
      );
    case 'driver':
      return (
        <Badge variant="success" className="flex w-fit items-center gap-1 text-xs">
          <Truck className="h-3 w-3" /> Driver
        </Badge>
      );
    case 'accountant':
      return (
        <Badge
          variant="outline"
          className="flex w-fit items-center gap-1 text-xs border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-700"
        >
          <Calculator className="h-3 w-3" /> Accountant
        </Badge>
      );
    default:
      return <Badge variant="secondary">{role}</Badge>;
  }
};

const initials = (e: Employee) =>
  `${e.firstName?.[0] ?? ''}${e.lastName?.[0] ?? ''}`.toUpperCase();

// ── Employee card (mobile) ────────────────────────────────────────────────────

interface CardProps {
  employee:     Employee;
  onEdit:       (e: Employee) => void;
  onReset:      (e: Employee) => void;
  onDeactivate: (e: Employee) => void;
  onReactivate: (e: Employee) => void;
}

const EmployeeCard: React.FC<CardProps> = ({
  employee: e, onEdit, onReset, onDeactivate, onReactivate,
}) => (
  <Card className="p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className={!e.isActive ? 'opacity-40' : ''}>
            {initials(e)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className={`font-semibold truncate leading-tight ${!e.isActive ? 'text-muted-foreground line-through' : ''}`}>
            {e.fullName}
          </p>
          <p className="text-xs text-muted-foreground truncate">{e.email}</p>
          {e.phone && (
            <p className="text-xs text-muted-foreground">{e.phone}</p>
          )}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(e)}>
            <UserCog className="mr-2 h-4 w-4" /> Edit Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onReset(e)}>
            <RefreshCw className="mr-2 h-4 w-4" /> Reset Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {e.isActive ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDeactivate(e)}
            >
              <UserX className="mr-2 h-4 w-4" /> Deactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => onReactivate(e)}>
              <UserCheck className="mr-2 h-4 w-4" /> Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-2">
      <RoleBadge role={e.role} />
      <Badge variant={e.isActive ? 'success' : 'secondary'} className="text-xs">
        {e.isActive ? 'Active' : 'Inactive'}
      </Badge>
      <Badge variant={e.isVerified ? 'success' : 'warning'} className="text-xs">
        {e.isVerified ? 'Verified' : 'Pending'}
      </Badge>

      {/* Number plate — drivers only */}
      {e.role === 'driver' && (
        e.numberPlate ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-medium tracking-wider">
            <Car className="h-3 w-3 text-muted-foreground" />
            {e.numberPlate}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-warning/60 bg-warning/10 px-2 py-0.5 text-[11px] text-warning-foreground">
            <Car className="h-3 w-3" /> No vehicle
          </span>
        )
      )}
    </div>

    <p className="mt-2 text-[11px] text-muted-foreground">
      Last login:{' '}
      {e.lastLogin ? new Date(e.lastLogin).toLocaleDateString() : 'Never'}
    </p>
  </Card>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const EmployeesPage: React.FC = () => {
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total,     setTotal]     = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery,   setSearchQuery]   = useState('');
  const [roleFilter,    setRoleFilter]    = useState<EmployeeRole | ''>('');
  const [statusFilter,  setStatusFilter]  = useState<'active' | 'inactive' | ''>('');

  const [showAdd,    setShowAdd]    = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);

  const [credentials, setCredentials] = useState<{
    email: string; password: string; name: string; isReset: boolean;
  } | null>(null);

  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<Employee | null>(null);
  const [resetTarget,      setResetTarget]      = useState<Employee | null>(null);
  const [actionLoading,    setActionLoading]    = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await employeeService.getEmployees({
        search: searchQuery  || undefined,
        role:   roleFilter   || undefined,
        status: statusFilter || undefined,
        limit:  100,
      });
      setEmployees(data.data);
      setTotal(data.total);
    } catch {
      toast({
        title:       'Error',
        description: 'Failed to load employees.',
        variant:     'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, roleFilter, statusFilter, toast]);

  useEffect(() => {
    const t = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(t);
  }, [fetchEmployees]);

  // ── Derived stats ──────────────────────────────────────────────────────────

  const siteManagers    = employees.filter(e => e.role === 'site_manager');
  const drivers         = employees.filter(e => e.role === 'driver');
  const accountants     = employees.filter(e => e.role === 'accountant');
  const activeEmployees = employees.filter(e => e.isActive);
  const noVehicle       = drivers.filter(e => !e.numberPlate).length;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreated = (employee: Employee, password: string) => {
    setEmployees(prev => [employee, ...prev]);
    setTotal(t => t + 1);
    setCredentials({
      email:    employee.email,
      password,
      name:     employee.fullName,
      isReset:  false,
    });
  };

  const handleUpdated = (updated: Employee) => {
    setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setActionLoading(true);
    try {
      const { employee } = await employeeService.deactivateEmployee(deactivateTarget.id);
      setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));
      toast({
        title:       'Employee deactivated',
        description: `${employee.fullName} can no longer log in.`,
      });
      setDeactivateTarget(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to deactivate.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!reactivateTarget) return;
    setActionLoading(true);
    try {
      const { employee } = await employeeService.reactivateEmployee(reactivateTarget.id);
      setEmployees(prev => prev.map(e => e.id === employee.id ? employee : e));
      toast({
        title:       'Employee reactivated',
        description: `${employee.fullName} can log in again.`,
      });
      setReactivateTarget(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to reactivate.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setActionLoading(true);
    try {
      const result = await employeeService.resetPassword(resetTarget.id);
      setCredentials({
        email:    result.employee.email,
        password: result.temporary_password,
        name:     result.employee.fullName,
        isReset:  true,
      });
      setResetTarget(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to reset password.', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Table columns (desktop) ───────────────────────────────────────────────

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (e) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className={!e.isActive ? 'opacity-50' : ''}>
              {initials(e)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className={`font-medium ${!e.isActive ? 'text-muted-foreground line-through' : ''}`}>
              {e.fullName}
            </p>
            <p className="text-sm text-muted-foreground">{e.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (e) => <span className="text-sm">{e.phone || '—'}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (e) => <RoleBadge role={e.role} />,
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (e) =>
        e.role === 'driver' ? (
          e.numberPlate ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-medium tracking-wider">
              <Car className="h-3 w-3 text-muted-foreground" />
              {e.numberPlate}
            </span>
          ) : (
            <Badge variant="warning" className="text-xs">No vehicle</Badge>
          )
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => (
        <Badge variant={e.isActive ? 'success' : 'secondary'}>
          {e.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'verified',
      header: 'Verified',
      render: (e) => (
        <Badge variant={e.isVerified ? 'success' : 'warning'}>
          {e.isVerified ? 'Verified' : 'Pending'}
        </Badge>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      render: (e) =>
        e.lastLogin
          ? new Date(e.lastLogin).toLocaleDateString()
          : <span className="text-sm text-muted-foreground">Never</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (employee) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditTarget(employee)}>
              <UserCog className="mr-2 h-4 w-4" /> Edit Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setResetTarget(employee)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reset Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {employee.isActive ? (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeactivateTarget(employee)}
              >
                <UserX className="mr-2 h-4 w-4" /> Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setReactivateTarget(employee)}>
                <UserCheck className="mr-2 h-4 w-4" /> Reactivate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout title="Employees" subtitle="Manage your team members">

      {/* ── Stats ── */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: 'Total',
            value: total,
            icon:  <Users       className="h-4 w-4 text-primary"  />,
            bg:    'bg-primary/10',
          },
          {
            label: 'Active',
            value: activeEmployees.length,
            icon:  <UserCheck   className="h-4 w-4 text-success"  />,
            bg:    'bg-success/10',
          },
          {
            label: 'Drivers',
            value: drivers.length,
            icon:  <Truck       className="h-4 w-4 text-accent"   />,
            bg:    'bg-accent/10',
          },
          {
            label: 'Accountants',
            value: accountants.length,
            icon:  <Calculator  className="h-4 w-4 text-violet-500" />,
            bg:    'bg-violet-500/10',
          },
        ].map(s => (
          <Card key={s.label} className="p-3 md:p-4">
            <div className="flex items-center gap-2.5">
              <div className={`rounded-lg p-2 ${s.bg} shrink-0`}>{s.icon}</div>
              <div>
                <p className="text-xl font-bold leading-none md:text-2xl">{s.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* No-vehicle alert */}
      {noVehicle > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <Car className="h-4 w-4 shrink-0 text-warning" />
          <span>
            <strong>{noVehicle}</strong> driver{noVehicle > 1 ? 's have' : ' has'} no vehicle
            assigned. Tap <strong>Edit Details</strong> to assign one.
          </span>
        </div>
      )}

      {/* ── Filters + Add ── */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search employees…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            value={roleFilter || 'all'}
            onValueChange={v =>
              setRoleFilter(v === 'all' ? '' : v as EmployeeRole)
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="site_manager">
                <span className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-blue-500" />
                  Site Manager
                </span>
              </SelectItem>
              <SelectItem value="driver">
                <span className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 text-green-500" />
                  Driver
                </span>
              </SelectItem>
              <SelectItem value="accountant">
                <span className="flex items-center gap-2">
                  <Calculator className="h-3.5 w-3.5 text-violet-500" />
                  Accountant
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter || 'all'}
            onValueChange={v =>
              setStatusFilter(v === 'all' ? '' : v as 'active' | 'inactive')
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="ocean"
          className="w-full sm:w-auto"
          onClick={() => setShowAdd(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Employee
        </Button>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : employees.length === 0 ? (
        <Card className="border-dashed border-2">
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="rounded-full bg-muted/50 p-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold">No employees yet</p>
            <p className="text-sm text-muted-foreground">
              Add your first team member to get started.
            </p>
            <Button variant="ocean" onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Employee
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {employees.map(e => (
              <EmployeeCard
                key={e.id}
                employee={e}
                onEdit={setEditTarget}
                onReset={setResetTarget}
                onDeactivate={setDeactivateTarget}
                onReactivate={setReactivateTarget}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block">
            <DataTable columns={columns} data={employees} />
          </div>
        </>
      )}

      {/* ── Dialogs ── */}
      <AddEmployeeDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={handleCreated}
      />

      <EditEmployeeDialog
        open={editTarget !== null}
        employee={editTarget}
        onClose={() => setEditTarget(null)}
        onUpdated={handleUpdated}
      />

      {credentials && (
        <CredentialsDialog
          open
          email={credentials.email}
          password={credentials.password}
          employeeName={credentials.name}
          isReset={credentials.isReset}
          onClose={() => setCredentials(null)}
        />
      )}

      <ConfirmDialog
        open={deactivateTarget !== null}
        title="Deactivate Employee"
        description={`Deactivate ${deactivateTarget?.fullName}? They will no longer be able to log in.`}
        confirmLabel="Deactivate"
        confirmVariant="destructive"
        isLoading={actionLoading}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />

      <ConfirmDialog
        open={reactivateTarget !== null}
        title="Reactivate Employee"
        description={`Reactivate ${reactivateTarget?.fullName}? They will be able to log in again.`}
        confirmLabel="Reactivate"
        confirmVariant="ocean"
        isLoading={actionLoading}
        onConfirm={handleReactivate}
        onCancel={() => setReactivateTarget(null)}
      />

      <ConfirmDialog
        open={resetTarget !== null}
        title="Reset Password"
        description={`Generate a new temporary password for ${resetTarget?.fullName}?`}
        confirmLabel="Reset Password"
        confirmVariant="ocean"
        isLoading={actionLoading}
        onConfirm={handleResetPassword}
        onCancel={() => setResetTarget(null)}
      />
    </DashboardLayout>
  );
};

export default EmployeesPage;