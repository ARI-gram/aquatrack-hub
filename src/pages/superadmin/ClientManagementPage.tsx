/**
 * Client Management Page
 * Role: Super Admin
 * Route: /admin/clients
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { CreateClientDialog } from '@/components/dialogs/Createclientdialog';
import { ClientDetailsSheet } from '@/components/dialogs/ClientDetailsSheet';
import { EditClientDialog } from '@/components/dialogs/EditClientDialog';
import { ClientBillingSheet } from '@/components/dialogs/ClientBillingSheet';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Search, MoreHorizontal, Building2, Users, Package,
  TrendingUp, Edit, Eye, CreditCard, Ban, KeyRound,
  Loader2, AlertCircle, RefreshCw, Copy, Check,
  ShieldAlert, CheckCircle2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { clientsService } from '@/api/services/clients.service';
import type { CredentialsResponse } from '@/api/services/clients.service';
import axiosInstance from '@/api/axios.config';
import { API_ENDPOINTS } from '@/api/endpoints';
import type { SubscriptionStatus } from '@/types/client.types';
import type { Client } from '@/api/services/clients.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<SubscriptionStatus, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  active: 'success', inactive: 'destructive', trial: 'warning', cancelled: 'secondary',
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active', inactive: 'Inactive', trial: 'Trial', cancelled: 'Cancelled',
};

const PLAN_LABELS: Record<string, string> = {
  trial: 'Free Trial', basic: 'Starter', pro: 'Professional', enterprise: 'Enterprise',
};

// ─── Credentials Dialog ───────────────────────────────────────────────────────

interface CredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  credentials: CredentialsResponse | null;
  clientName: string;
  mode: 'created' | 'reset'; // slightly different copy
}

const CredentialsDialog: React.FC<CredentialsDialogProps> = ({
  open, onClose, credentials, clientName, mode,
}) => {
  const [copiedEmail, setCopiedEmail]       = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  if (!credentials) return null;

  const copy = async (text: string, type: 'email' | 'password') => {
    await navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const copyBoth = () => copy(
    `Email: ${credentials.user.email}\nPassword: ${credentials.temporary_password}`,
    'password'
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-success/10 via-success/5 to-transparent border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-success flex items-center justify-center shadow-lg shadow-success/25 shrink-0">
              {mode === 'reset'
                ? <KeyRound className="h-5 w-5 text-white" />
                : <CheckCircle2 className="h-5 w-5 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight">
                {mode === 'reset' ? 'Credentials Reset' : 'Client Created'}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {mode === 'reset'
                  ? `New password generated for ${clientName}`
                  : `Share these credentials with ${clientName}`}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Login Email
            </Label>
            <div className="flex gap-2">
              <Input
                value={credentials.user.email}
                readOnly
                className="h-10 bg-muted/40 font-medium text-foreground cursor-default"
              />
              <Button
                type="button" size="icon" variant="outline"
                className="h-10 w-10 shrink-0"
                onClick={() => copy(credentials.user.email, 'email')}
              >
                {copiedEmail ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {mode === 'reset' ? 'New Temporary Password' : 'Temporary Password'}
            </Label>
            <div className="flex gap-2">
              <Input
                value={credentials.temporary_password}
                readOnly
                className="h-10 bg-muted/40 font-mono tracking-widest text-foreground cursor-default"
              />
              <Button
                type="button" size="icon" variant="outline"
                className="h-10 w-10 shrink-0"
                onClick={() => copy(credentials.temporary_password, 'password')}
              >
                {copiedPassword ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-warning/10 border border-warning/25">
            <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-warning mb-0.5">Share securely</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {mode === 'reset'
                  ? 'An email has already been sent to the client. Share this password through a secure channel as a backup. They must change it on next login.'
                  : 'Send these credentials through a secure channel. The client will be prompted to change their password on first login. This password will not be shown again.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={copyBoth} className="gap-2">
            <Copy className="h-4 w-4" />Copy Both
          </Button>
          <Button type="button" variant="ocean" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Send Credentials confirmation dialog ─────────────────────────────────────

interface SendCredentialsConfirmProps {
  client: Client | null;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

const SendCredentialsConfirm: React.FC<SendCredentialsConfirmProps> = ({
  client, onConfirm, onCancel, isPending,
}) => (
  <AlertDialog open={!!client} onOpenChange={(o) => { if (!o) onCancel(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          Reset & Send Credentials
        </AlertDialogTitle>
        <AlertDialogDescription className="space-y-2">
          <span className="block">
            This will generate a <strong>new temporary password</strong> for{' '}
            <strong>{client?.name}</strong> and immediately email it to{' '}
            <strong>{client?.email}</strong>.
          </span>
          <span className="block text-warning font-medium">
            Their current password will stop working.
          </span>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          disabled={isPending}
          className="bg-primary hover:bg-primary/90"
        >
          {isPending
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
            : <><KeyRound className="h-4 w-4 mr-2" />Reset & Send</>}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const ClientManagementPage: React.FC = () => {
  const [searchQuery, setSearchQuery]   = useState('');
  const [currentPage, setCurrentPage]   = useState(1);

  // Panel state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [detailsOpen, setDetailsOpen]       = useState(false);
  const [editOpen, setEditOpen]             = useState(false);
  const [billingOpen, setBillingOpen]       = useState(false);
  const [suspendTarget, setSuspendTarget]   = useState<Client | null>(null);

  // Send credentials state
  const [credsSendTarget, setCredsSendTarget]   = useState<Client | null>(null);
  const [credsDialogOpen, setCredsDialogOpen]   = useState(false);
  const [credsResult, setCredsResult]           = useState<CredentialsResponse | null>(null);
  const [credsClientName, setCredsClientName]   = useState('');
  const [credsMode, setCredsMode]               = useState<'created' | 'reset'>('reset');

  const queryClient = useQueryClient();

  const openDetails = (c: Client) => { setSelectedClient(c); setDetailsOpen(true); };
  const openEdit    = (c: Client) => { setSelectedClient(c); setEditOpen(true); };
  const openBilling = (c: Client) => { setSelectedClient(c); setBillingOpen(true); };
  const openSuspend = (c: Client) => setSuspendTarget(c);
  const openSendCreds = (c: Client) => setCredsSendTarget(c);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['clients', { search: searchQuery, page: currentPage }],
    queryFn: () => clientsService.getClients({
      search: searchQuery || undefined,
      page: currentPage,
      limit: 20,
    }),
    placeholderData: (prev) => prev,
  });

  const clients       = data?.data ?? [];
  const total         = data?.total ?? 0;
  const activeCount   = clients.filter((c) => c.subscriptionStatus === 'active').length;
  const trialCount    = clients.filter((c) => c.subscriptionStatus === 'trial').length;
  const inactiveCount = clients.filter(
    (c) => c.subscriptionStatus === 'inactive' || c.subscriptionStatus === 'cancelled'
  ).length;

  // ── Suspend mutation ───────────────────────────────────────────────────────
  const suspendMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.post(API_ENDPOINTS.CLIENTS.SUSPEND(id)),
    onSuccess: () => {
      toast.success(`${suspendTarget?.name} has been suspended`);
      setSuspendTarget(null);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: () => {
      toast.error('Failed to suspend account');
      setSuspendTarget(null);
    },
  });

  // ── Reset credentials mutation ─────────────────────────────────────────────
  const resetCredsMutation = useMutation({
    mutationFn: (id: string) => clientsService.resetCredentials(id),
    onSuccess: (response) => {
      // Close confirm dialog and show the credentials
      setCredsClientName(credsSendTarget?.name ?? '');
      setCredsMode('reset');
      setCredsResult(response);
      setCredsSendTarget(null);
      setCredsDialogOpen(true);
      toast.success('Credentials reset — email sent to client');
    },
    onError: () => {
      toast.error('Failed to reset credentials. Please try again.');
      setCredsSendTarget(null);
    },
  });

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Company',
      render: (client) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {client.logo
              ? <img src={client.logo} alt={client.name} className="h-10 w-10 rounded-lg object-cover" />
              : <Building2 className="h-5 w-5 text-primary" />}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{client.name}</p>
            <p className="text-sm text-muted-foreground truncate">{client.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'subscriptionPlan',
      header: 'Plan',
      render: (client) => (
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm">{PLAN_LABELS[client.subscriptionPlan] ?? client.subscriptionPlan}</span>
        </div>
      ),
    },
    {
      key: 'subscriptionStatus',
      header: 'Status',
      render: (client) => (
        <Badge variant={STATUS_VARIANTS[client.subscriptionStatus]}>
          {STATUS_LABELS[client.subscriptionStatus]}
        </Badge>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (client) => (
        <span className="text-sm text-muted-foreground">{client.phone}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (client) => (
        <span className="text-sm text-muted-foreground">
          {new Date(client.createdAt).toLocaleDateString('en-KE', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (client) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">

            <DropdownMenuItem onClick={() => openDetails(client)}>
              <Eye className="h-4 w-4 mr-2" />View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openEdit(client)}>
              <Edit className="h-4 w-4 mr-2" />Edit Client
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openBilling(client)}>
              <CreditCard className="h-4 w-4 mr-2" />View Billing
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* ── Send Credentials ── */}
            <DropdownMenuItem
              onClick={() => openSendCreds(client)}
              className="text-primary focus:text-primary"
            >
              <KeyRound className="h-4 w-4 mr-2" />Send Credentials
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => openSuspend(client)}
              className="text-destructive focus:text-destructive"
              disabled={
                client.subscriptionStatus === 'inactive' ||
                client.subscriptionStatus === 'cancelled'
              }
            >
              <Ban className="h-4 w-4 mr-2" />Suspend Account
            </DropdownMenuItem>

          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DashboardLayout title="Client Management" subtitle="Manage distributor accounts">

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Building2,  color: 'primary', label: 'Total Clients',        value: total },
          { icon: TrendingUp, color: 'success',  label: 'Active Clients',       value: activeCount },
          { icon: Package,    color: 'warning',  label: 'On Free Trial',        value: trialCount },
          { icon: Users,      color: 'accent',   label: 'Inactive / Cancelled', value: inactiveCount },
        ].map(({ icon: Icon, color, label, value }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${color}/10`}>
                <Icon className={`h-5 w-5 text-${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? '—' : value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Search + Add ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <CreateClientDialog />
        </div>
      </div>

      {/* ── Table / states ────────────────────────────────────────────────── */}
      {isError ? (
        <Card className="p-12 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-10 w-10 text-destructive opacity-60" />
          <p className="font-medium">Failed to load clients</p>
          <p className="text-sm text-muted-foreground">There was a problem fetching client data.</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />Try Again
          </Button>
        </Card>
      ) : isLoading ? (
        <Card className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading clients...</p>
        </Card>
      ) : clients.length === 0 ? (
        <Card className="p-12 flex flex-col items-center gap-3 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground opacity-40" />
          <p className="font-medium">
            {searchQuery ? 'No clients match your search' : 'No clients yet'}
          </p>
          {!searchQuery && (
            <p className="text-sm text-muted-foreground">
              Add your first distributor client to get started.
            </p>
          )}
        </Card>
      ) : (
        <DataTable columns={columns} data={clients} />
      )}

      {/* ── Pagination ────────────────────────────────────────────────────── */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, total)} of {total} clients
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={currentPage === data.totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* ── Side panels ───────────────────────────────────────────────────── */}
      <ClientDetailsSheet client={selectedClient} open={detailsOpen} onOpenChange={setDetailsOpen} />
      <EditClientDialog client={selectedClient} open={editOpen} onOpenChange={setEditOpen} />
      <ClientBillingSheet client={selectedClient} open={billingOpen} onOpenChange={setBillingOpen} />

      {/* ── Suspend confirmation ───────────────────────────────────────────── */}
      <AlertDialog open={!!suspendTarget} onOpenChange={(o) => { if (!o) setSuspendTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {suspendTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately set their account to <strong>Inactive</strong> and block
              access to the platform. You can reactivate them at any time via Edit Client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={suspendMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => suspendTarget && suspendMutation.mutate(suspendTarget.id)}
              disabled={suspendMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {suspendMutation.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Suspending...</>
                : 'Yes, Suspend Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Send Credentials — confirm then show result ────────────────────── */}
      <SendCredentialsConfirm
        client={credsSendTarget}
        onConfirm={() => credsSendTarget && resetCredsMutation.mutate(credsSendTarget.id)}
        onCancel={() => setCredsSendTarget(null)}
        isPending={resetCredsMutation.isPending}
      />

      <CredentialsDialog
        open={credsDialogOpen}
        onClose={() => { setCredsDialogOpen(false); setCredsResult(null); }}
        credentials={credsResult}
        clientName={credsClientName}
        mode={credsMode}
      />

    </DashboardLayout>
  );
};

export default ClientManagementPage;