// /src/pages/client/CustomersPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Plus, Search, Download, MoreHorizontal, Wallet, Phone, Mail,
  RefreshCw, ShieldOff, ShieldCheck, Loader2, Users, UserCheck,
  Clock, Lock, AlertTriangle, Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddCustomerDialog } from '@/components/dialogs/AddCustomerDialog';
import { CustomerInviteDialog } from '@/components/dialogs/CustomerInviteDialog';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { customerAdminService, AdminCustomer } from '@/api/services/customerAdmin.service';

export const CustomersPage: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [inviteData, setInviteData] = useState<{ customer: AdminCustomer; inviteUrl: string } | null>(null);
  const [blockTarget, setBlockTarget] = useState<AdminCustomer | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<AdminCustomer | null>(null);
  const [resendTarget, setResendTarget] = useState<AdminCustomer | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await customerAdminService.getCustomers({
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        limit: 100,
      });
      setCustomers(data.data);
      setTotal(data.total);
    } catch {
      toast({ title: 'Error', description: 'Failed to load customers.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, typeFilter, toast]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  const activeCount  = customers.filter((c) => c.status === 'ACTIVE').length;
  const pendingCount = customers.filter((c) => c.invite_pending).length;
  const frozenCount  = customers.filter((c) => c.credit_terms?.account_frozen).length;
  const totalWallet  = customers.reduce((s, c) => s + parseFloat(c.wallet_balance || '0'), 0).toFixed(2);

  const handleCreated = (customer: AdminCustomer, inviteUrl: string) => {
    setCustomers((prev) => [customer, ...prev]);
    setTotal((t) => t + 1);
    setInviteData({ customer, inviteUrl });
  };

  const handleBlock = async () => {
    if (!blockTarget) return;
    setActionLoading(true);
    try {
      const { customer } = await customerAdminService.blockCustomer(blockTarget.id);
      setCustomers((prev) => prev.map((c) => (c.id === customer.id ? customer : c)));
      toast({ title: `${customer.full_name} has been blocked.` });
      setBlockTarget(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to block customer.', variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  const handleUnblock = async () => {
    if (!unblockTarget) return;
    setActionLoading(true);
    try {
      const { customer } = await customerAdminService.unblockCustomer(unblockTarget.id);
      setCustomers((prev) => prev.map((c) => (c.id === customer.id ? customer : c)));
      toast({ title: `${customer.full_name} has been unblocked.` });
      setUnblockTarget(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to unblock customer.', variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  const handleResendInvite = async () => {
    if (!resendTarget) return;
    setActionLoading(true);
    try {
      const result = await customerAdminService.resendInvite(resendTarget.id);
      toast({ title: 'Invite resent', description: result.message });
      setResendTarget(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to resend invite.', variant: 'destructive' });
    } finally { setActionLoading(false); }
  };

  // ── Credit status badge ───────────────────────────────────────────────────
  const CreditBadge = ({ customer: c }: { customer: AdminCustomer }) => {
    const ct = c.credit_terms;
    if (!ct) return null;
    if (ct.account_frozen) return (
      <Badge variant="destructive" className="gap-1 text-xs w-fit">
        <Lock className="h-2.5 w-2.5" /> Frozen
      </Badge>
    );
    if (ct.is_in_grace_period) return (
      <Badge variant="warning" className="gap-1 text-xs w-fit">
        <AlertTriangle className="h-2.5 w-2.5" /> Overdue
      </Badge>
    );
    return null;
  };

  const columns: Column<AdminCustomer>[] = [
    {
      key: 'full_name',
      header: 'Customer',
      render: (c) => (
        <div className="flex items-center gap-3">
          <Avatar><AvatarFallback>{c.full_name[0]}</AvatarFallback></Avatar>
          <div>
            <p className="font-medium text-foreground">{c.full_name}</p>
            <p className="text-xs text-muted-foreground">{c.email || '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone_number',
      header: 'Phone',
      render: (c) => (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />
          <span className="text-sm">{c.phone_number}</span>
        </div>
      ),
    },
    {
      key: 'customer_type_display',
      header: 'Type',
      render: (c) => (
        <Badge variant={c.customer_type === 'REFILL' ? 'success' : 'info'}>
          {c.customer_type_display}
        </Badge>
      ),
    },
    {
      key: 'wallet_balance',
      header: 'Wallet',
      render: (c) => (
        <div className="flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-success" />
          <span className={`font-medium text-sm ${parseFloat(c.wallet_balance) > 0 ? 'text-success' : 'text-muted-foreground'}`}>
            KES {parseFloat(c.wallet_balance).toFixed(2)}
          </span>
        </div>
      ),
    },
    {
      key: 'total_orders',
      header: 'Orders',
      render: (c) => <span className="font-medium text-foreground">{c.total_orders}</span>,
    },
    {
      key: 'is_registered',
      header: 'Status',
      render: (c) => (
        <div className="flex flex-col gap-1">
          {!c.is_registered ? (
            <Badge variant="warning" className="flex items-center gap-1 w-fit">
              <Clock className="h-3 w-3" /> Invite Pending
            </Badge>
          ) : (
            <Badge
              variant={c.status === 'ACTIVE' ? 'success' : c.status === 'BLOCKED' ? 'destructive' : 'secondary'}
              className="w-fit"
            >
              {c.status_display}
            </Badge>
          )}
          <CreditBadge customer={c} />
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/customers/${c.id}`)}>
              <Eye className="mr-2 h-4 w-4" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/customers/${c.id}?tab=Orders`)}>
              View Orders
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/customers/${c.id}?tab=Wallet`)}>
              Manage Wallet
            </DropdownMenuItem>
            {c.invite_pending && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setResendTarget(c); }}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Resend Invite
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            {c.status === 'BLOCKED' ? (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setUnblockTarget(c); }}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Unblock Customer
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); setBlockTarget(c); }}
              >
                <ShieldOff className="mr-2 h-4 w-4" /> Block Customer
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DashboardLayout title="Customers" subtitle="Manage customer accounts and invites">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: <Users className="h-4 w-4 text-primary" />, bg: 'bg-primary/10', label: 'Total', value: total, cls: 'text-foreground' },
          { icon: <UserCheck className="h-4 w-4 text-success" />, bg: 'bg-success/10', label: 'Active', value: activeCount, cls: 'text-success' },
          { icon: <Mail className="h-4 w-4 text-warning" />, bg: 'bg-warning/10', label: 'Invite Pending', value: pendingCount, cls: 'text-warning' },
        ].map(({ icon, bg, label, value, cls }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className={`text-2xl font-bold ${cls}`}>{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {frozenCount > 0 ? (
          <Card className="border-border/50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-50">
                  <Lock className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Frozen Accounts</p>
                  <p className="text-2xl font-bold text-red-600">{frozenCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Wallet className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Wallet</p>
                  <p className="text-2xl font-bold text-foreground">KES {totalWallet}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6 border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-1 gap-3 w-full md:w-auto flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter || 'all'} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="REFILL">Refill</SelectItem>
                  <SelectItem value="ONETIME">One-time</SelectItem>
                  <SelectItem value="HYBRID">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="gap-2 flex-1 md:flex-initial">
                <Download className="h-4 w-4" /> Export
              </Button>
              <Button variant="ocean" className="gap-2 flex-1 md:flex-initial" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" /> Add Customer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={customers}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          emptyMessage="No customers found"
        />
      )}

      <AddCustomerDialog open={showAdd} onClose={() => setShowAdd(false)} onCreated={handleCreated} />
      <CustomerInviteDialog
        open={inviteData !== null}
        customer={inviteData?.customer ?? null}
        inviteUrl={inviteData?.inviteUrl ?? ''}
        onClose={() => setInviteData(null)}
      />
      <ConfirmDialog
        open={blockTarget !== null}
        title="Block Customer"
        description={`Block ${blockTarget?.full_name}? They will not be able to place orders.`}
        confirmLabel="Block" confirmVariant="destructive" isLoading={actionLoading}
        onConfirm={handleBlock} onCancel={() => setBlockTarget(null)}
      />
      <ConfirmDialog
        open={unblockTarget !== null}
        title="Unblock Customer"
        description={`Unblock ${unblockTarget?.full_name}? They will be able to place orders again.`}
        confirmLabel="Unblock" confirmVariant="ocean" isLoading={actionLoading}
        onConfirm={handleUnblock} onCancel={() => setUnblockTarget(null)}
      />
      <ConfirmDialog
        open={resendTarget !== null}
        title="Resend Invite"
        description={`Send a new invite email to ${resendTarget?.full_name} at ${resendTarget?.email}? The old invite link will be invalidated.`}
        confirmLabel="Resend Invite" confirmVariant="ocean" isLoading={actionLoading}
        onConfirm={handleResendInvite} onCancel={() => setResendTarget(null)}
      />
    </DashboardLayout>
  );
};