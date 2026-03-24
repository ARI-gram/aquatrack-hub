/**
 * Client Details Sheet
 * Slide-over panel showing full client profile + live stats
 * src/components/dialogs/ClientDetailsSheet.tsx
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { clientsService } from '@/api/services/clients.service';
import type { Client } from '@/api/services/clients.service';
import {
  Building2, Mail, Phone, Globe, MapPin,
  Users, Calendar, CreditCard, BarChart3,
  Package, TrendingUp, AlertCircle,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_VARIANTS: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  active: 'success',
  inactive: 'destructive',
  trial: 'warning',
  cancelled: 'secondary',
};

const PLAN_LABELS: Record<string, string> = {
  trial: 'Free Trial',
  basic: 'Starter',
  pro: 'Professional',
  enterprise: 'Enterprise',
};

const Field: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode }> = ({
  icon: Icon, label, value,
}) => (
  <div className="flex items-start gap-3">
    <div className="p-1.5 rounded-md bg-muted shrink-0 mt-0.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value || '—'}</p>
    </div>
  </div>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClientDetailsSheetProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ClientDetailsSheet: React.FC<ClientDetailsSheetProps> = ({
  client, open, onOpenChange,
}) => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['client-stats', client?.id],
    queryFn: () => clientsService.getClientStats(client!.id),
    enabled: !!client?.id && open,
  });

  if (!client) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {client.logo ? (
                <img src={client.logo} alt={client.name} className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <Building2 className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <SheetTitle className="text-lg">{client.name}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <Badge variant={STATUS_VARIANTS[client.subscriptionStatus]}>
                  {client.subscriptionStatus.charAt(0).toUpperCase() + client.subscriptionStatus.slice(1)}
                </Badge>
                <span className="text-xs">
                  {PLAN_LABELS[client.subscriptionPlan] ?? client.subscriptionPlan}
                </span>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* ── Live stats ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Package,    label: 'Total Orders',    key: 'totalOrders' },
              { icon: TrendingUp, label: 'Deliveries',      key: 'totalDeliveries' },
              { icon: Users,      label: 'Customers',       key: 'totalCustomers' },
              { icon: Users,      label: 'Employees',       key: 'totalEmployees' },
            ].map(({ icon: Icon, label, key }) => (
              <Card key={key} className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                {statsLoading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <p className="text-xl font-bold">
                    {stats?.[key as keyof typeof stats] ?? '—'}
                  </p>
                )}
              </Card>
            ))}
          </div>

          {/* ── Revenue ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Monthly Revenue</span>
              </div>
              {statsLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <p className="text-xl font-bold text-success">
                  KSh {(stats?.monthlyRevenue ?? 0).toLocaleString()}
                </p>
              )}
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Outstanding</span>
              </div>
              {statsLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <p className={`text-xl font-bold ${(stats?.outstandingPayments ?? 0) > 0 ? 'text-destructive' : ''}`}>
                  KSh {(stats?.outstandingPayments ?? 0).toLocaleString()}
                </p>
              )}
            </Card>
          </div>

          {/* ── Contact details ─────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Contact
            </p>
            <div className="space-y-3">
              <Field icon={Mail}  label="Email"   value={client.email} />
              <Field icon={Phone} label="Phone"   value={client.phone} />
              {client.website && (
                <Field
                  icon={Globe}
                  label="Website"
                  value={
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {client.website}
                    </a>
                  }
                />
              )}
            </div>
          </div>

          {/* ── Address ─────────────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Address
            </p>
            <Field
              icon={MapPin}
              label="Location"
              value={[client.address, client.city, client.state, client.zipCode, client.country]
                .filter(Boolean)
                .join(', ')}
            />
          </div>

          {/* ── Subscription ─────────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Subscription
            </p>
            <div className="space-y-3">
              <Field
                icon={CreditCard}
                label="Plan"
                value={PLAN_LABELS[client.subscriptionPlan] ?? client.subscriptionPlan}
              />
              <Field
                icon={Calendar}
                label="Member Since"
                value={new Date(client.createdAt).toLocaleDateString('en-KE', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};