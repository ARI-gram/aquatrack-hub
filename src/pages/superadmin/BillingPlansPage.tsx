/**
 * Billing Plans Page
 * Role: Super Admin
 * Route: /admin/billing
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import billingService from '@/api/services/billing.service';   // ← use service
import type { Subscription, BillingStats } from '@/types/billing.types';
import {
  Check, CreditCard, DollarSign, Users, Zap, Gift,
  AlertTriangle, Clock, Database, Shield, Cpu, BarChart3,
  Bell, Globe, Smartphone, FileText, Headphones, RefreshCw,
  TrendingUp, Loader2, AlertCircle, Building2,
} from 'lucide-react';

// ─── Pricing constants ────────────────────────────────────────────────────────

const MONTHLY_PRICE = 15_000;
const BIANNUAL_MONTHS = 6;
const BIANNUAL_DISCOUNT = 0.15;
const ANNUAL_DISCOUNT = 0.30;
const ONBOARDING_FEE = 20_000;

const biannualTotal = Math.round(MONTHLY_PRICE * BIANNUAL_MONTHS * (1 - BIANNUAL_DISCOUNT));
const annualTotal   = Math.round(MONTHLY_PRICE * 12 * (1 - ANNUAL_DISCOUNT));

const BILLING_CYCLES = [
  {
    id: 'monthly',
    label: 'Monthly',
    badge: null,
    priceDisplay: `KSh ${MONTHLY_PRICE.toLocaleString()}`,
    period: '/ month',
    totalDisplay: null,
    savingsDisplay: null,
  },
  {
    id: 'biannual',
    label: '6-Month',
    badge: 'Save 15%',
    priceDisplay: `KSh ${Math.round(biannualTotal / 6).toLocaleString()}`,
    period: '/ month',
    totalDisplay: `KSh ${biannualTotal.toLocaleString()} billed every 6 months`,
    savingsDisplay: `Save KSh ${(MONTHLY_PRICE * 6 - biannualTotal).toLocaleString()} vs monthly`,
  },
  {
    id: 'annual',
    label: 'Annual',
    badge: 'Best Value — Save 30%',
    priceDisplay: `KSh ${Math.round(annualTotal / 12).toLocaleString()}`,
    period: '/ month',
    totalDisplay: `KSh ${annualTotal.toLocaleString()} billed annually`,
    savingsDisplay: `Save KSh ${(MONTHLY_PRICE * 12 - annualTotal).toLocaleString()} vs monthly`,
  },
];

const PLATFORM_FEATURES = [
  { icon: Database,   label: 'Cloud Database Management',       desc: 'Secure, redundant cloud storage with automated daily backups and point-in-time recovery.' },
  { icon: Shield,     label: 'Data Security & Compliance',      desc: 'End-to-end encryption, role-based access control, and audit logging for every action.' },
  { icon: Cpu,        label: 'Infrastructure & Uptime SLA',     desc: '99.9% uptime guarantee with auto-scaling infrastructure hosted on enterprise cloud.' },
  { icon: BarChart3,  label: 'Advanced Analytics & Reporting',  desc: 'Real-time dashboards, custom reports, revenue forecasting, and exportable data.' },
  { icon: Globe,      label: 'Real-Time Delivery Tracking',     desc: 'Live GPS tracking, route optimisation, and automated ETA notifications for customers.' },
  { icon: Smartphone, label: 'Mobile App (Driver & Customer)',  desc: 'Dedicated iOS & Android apps for drivers and customers with offline support.' },
  { icon: FileText,   label: 'Automated Invoicing & Billing',   desc: 'Auto-generate, send, and reconcile invoices. Supports M-Pesa and bank transfers.' },
  { icon: Bell,       label: 'SMS & Email Notifications',       desc: 'Automated delivery alerts, payment reminders, and low-stock notifications.' },
  { icon: RefreshCw,  label: 'Inventory & Bottle Management',   desc: 'Track stock levels, bottle returns, and automated reorder triggers across all sites.' },
  { icon: Users,      label: 'Multi-User Role Management',      desc: 'Unlimited staff accounts with granular permissions: Admin, Site Manager, Driver, Customer.' },
  { icon: TrendingUp, label: 'Business Intelligence Dashboard', desc: 'KPI tracking, trend analysis, and competitor benchmarks across your distribution network.' },
  { icon: Headphones, label: 'Dedicated Customer Support',      desc: 'Priority email and phone support with a dedicated account manager.' },
];

// ─── Payment warning banner ───────────────────────────────────────────────────

const PaymentWarningBanner: React.FC<{ subscriptions: Subscription[] }> = ({ subscriptions }) => {
  const overdue  = subscriptions.filter((s) => s.status === 'overdue');
  const warnings = subscriptions.filter((s) => s.daysUntilDue <= 7 && s.status !== 'cancelled');

  if (overdue.length === 0 && warnings.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {overdue.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue Payments — {overdue.length} account{overdue.length > 1 ? 's' : ''}</AlertTitle>
          <AlertDescription>
            {overdue.map((s) => s.clientName).join(', ')} {overdue.length === 1 ? 'has' : 'have'} an
            overdue subscription. Access may be suspended if payment is not received promptly.
          </AlertDescription>
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert className="border-warning bg-warning/5">
          <Clock className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">
            Upcoming Payments — {warnings.length} client{warnings.length > 1 ? 's' : ''}
          </AlertTitle>
          <AlertDescription>
            {warnings
              .map((s) => `${s.clientName} (due in ${s.daysUntilDue} day${s.daysUntilDue === 1 ? '' : 's'})`)
              .join(' · ')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const BillingPlansPage: React.FC = () => {
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'biannual' | 'annual'>('monthly');

  // ── Data fetching — now via billingService ────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<BillingStats>({
    queryKey: ['billing-stats'],
    queryFn: () => billingService.getStats(),
  });

  const {
    data: subscriptions = [],
    isLoading: subsLoading,
    isError: subsError,
    refetch,
  } = useQuery<Subscription[]>({
    queryKey: ['billing-subscriptions'],
    queryFn: () => billingService.getSubscriptions(),
  });

  const currentCycleData = BILLING_CYCLES.find((c) => c.id === selectedCycle)!;

  return (
    <DashboardLayout
      title="Billing & Subscription Plans"
      subtitle="AquaTrack platform pricing and subscription management"
    >
      {!subsLoading && !subsError && (
        <PaymentWarningBanner subscriptions={subscriptions} />
      )}

      <Tabs defaultValue="plans" className="space-y-6">
        <TabsList>
          <TabsTrigger value="plans">
            <CreditCard className="h-4 w-4 mr-2" />Pricing Plans
          </TabsTrigger>
          <TabsTrigger value="subscriptions">
            <Users className="h-4 w-4 mr-2" />Active Subscriptions
          </TabsTrigger>
          <TabsTrigger value="revenue">
            <BarChart3 className="h-4 w-4 mr-2" />Revenue Overview
          </TabsTrigger>
        </TabsList>

        {/* ── Pricing Plans ─────────────────────────────────────────────── */}
        <TabsContent value="plans" className="space-y-8">
          <Card className="p-5 border-primary/30 bg-primary/5">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">One-Time Onboarding Fee — KSh 20,000</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Every new client pays a one-time setup fee of{' '}
                  <strong>KSh {ONBOARDING_FEE.toLocaleString()}</strong> covering platform
                  configuration, data migration, staff training, and a dedicated go-live session.
                  Charged once before the subscription begins.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-success/30 bg-success/5">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-success/10 shrink-0">
                <Gift className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Free Trial — 10 to 14 Days</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  New clients get a <strong>10–14 day free trial</strong> with full platform access.
                  No credit card required. Reminders sent <strong>7 days</strong> and{' '}
                  <strong>3 days</strong> before trial ends.
                </p>
              </div>
            </div>
          </Card>

          <div>
            <h2 className="text-lg font-semibold mb-4">Choose Billing Cycle</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {BILLING_CYCLES.map((cycle) => (
                <button
                  key={cycle.id}
                  type="button"
                  onClick={() => setSelectedCycle(cycle.id as typeof selectedCycle)}
                  className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                    selectedCycle === cycle.id
                      ? 'border-primary bg-primary/5 shadow-md'
                      : 'border-border hover:border-primary/40 bg-background'
                  }`}
                >
                  {cycle.badge && (
                    <Badge
                      variant={cycle.id === 'annual' ? 'ocean' : 'success'}
                      className="absolute -top-3 left-4 text-xs"
                    >
                      {cycle.badge}
                    </Badge>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">{cycle.label}</span>
                    {selectedCycle === cycle.id && (
                      <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="mb-1">
                    <span className="text-3xl font-bold">{cycle.priceDisplay}</span>
                    <span className="text-sm text-muted-foreground ml-1">{cycle.period}</span>
                  </div>
                  {cycle.totalDisplay && (
                    <p className="text-xs text-muted-foreground mt-1">{cycle.totalDisplay}</p>
                  )}
                  {cycle.savingsDisplay && (
                    <p className="text-xs text-success font-medium mt-1">{cycle.savingsDisplay}</p>
                  )}
                </button>
              ))}
            </div>

            <Card className="mt-6 p-5 bg-muted/30">
              <h3 className="font-semibold mb-3">
                Selected Plan Summary —{' '}
                <span className="text-primary">{currentCycleData.label} Billing</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Subscription fee</p>
                  <p className="font-semibold">{currentCycleData.priceDisplay} {currentCycleData.period}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">One-time onboarding</p>
                  <p className="font-semibold">KSh {ONBOARDING_FEE.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Free trial</p>
                  <p className="font-semibold">10–14 days (full access)</p>
                </div>
              </div>
              {currentCycleData.savingsDisplay && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-sm text-success font-medium">
                    💰 {currentCycleData.savingsDisplay}
                  </p>
                </div>
              )}
            </Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-1">Everything Included in Your Subscription</h2>
            <p className="text-sm text-muted-foreground mb-5">
              All features available on every billing cycle. No hidden tiers.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLATFORM_FEATURES.map(({ icon: Icon, label, desc }) => (
                <Card key={label} className="p-4 flex gap-4 items-start">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Active Subscriptions ──────────────────────────────────────── */}
        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active Client Subscriptions</h2>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />Refresh
            </Button>
          </div>

          {subsLoading ? (
            <Card className="p-12 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Loading subscriptions...</span>
            </Card>
          ) : subsError ? (
            <Card className="p-12 flex flex-col items-center gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-destructive opacity-60" />
              <p className="font-medium">Failed to load subscriptions</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Try Again</Button>
            </Card>
          ) : subscriptions.length === 0 ? (
            <Card className="p-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
              <CreditCard className="h-10 w-10 opacity-30" />
              <p className="text-sm">No active subscriptions found.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {subscriptions.map((sub) => {
                const isOverdue = sub.status === 'overdue';
                const isWarning = sub.daysUntilDue <= 7 && sub.status !== 'cancelled';
                return (
                  <Card
                    key={sub.id}
                    className={`p-4 ${
                      isOverdue
                        ? 'border-destructive/50 bg-destructive/5'
                        : isWarning
                        ? 'border-warning/50 bg-warning/5'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{sub.clientName}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {sub.billingCycle} · {sub.plan}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            KSh {sub.amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sub.nextPaymentDate
                              ? `Due ${new Date(sub.nextPaymentDate).toLocaleDateString('en-KE', {
                                  day: 'numeric', month: 'short', year: 'numeric',
                                })}`
                              : 'No due date set'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                          {isWarning && !isOverdue && (
                            <Badge variant="warning">
                              <Clock className="h-3 w-3 mr-1" />
                              Due in {sub.daysUntilDue}d
                            </Badge>
                          )}
                          {!isOverdue && !isWarning && (
                            <Badge variant={sub.status === 'trial' ? 'warning' : 'success'}>
                              {sub.status === 'trial' ? 'Trial' : 'Active'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Revenue Overview ──────────────────────────────────────────── */}
        <TabsContent value="revenue" className="space-y-6">
          {statsLoading ? (
            <Card className="p-12 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Loading revenue data...</span>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10">
                      <DollarSign className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        KSh {(stats?.monthlyRevenue ?? 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        KSh {(stats?.annualRevenue ?? 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">Annual Revenue (projected)</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/10">
                      <Users className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.activeSubscriptions ?? '—'}</p>
                      <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <TrendingUp className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {stats?.trialConversionRate != null ? `${stats.trialConversionRate}%` : '—'}
                      </p>
                      <p className="text-sm text-muted-foreground">Trial Conversion Rate</p>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="p-6">
                <h3 className="font-semibold mb-4">Free Trial Pipeline</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Active Trials</p>
                    <p className="text-2xl font-bold mt-1">{stats?.trialSubscriptions ?? '—'}</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Conversion Rate</p>
                    <p className="text-2xl font-bold mt-1 text-success">
                      {stats?.trialConversionRate != null ? `${stats.trialConversionRate}%` : '—'}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Overdue Accounts</p>
                    <p className="text-2xl font-bold mt-1 text-destructive">
                      {stats?.overdueSubscriptions ?? '—'}
                    </p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default BillingPlansPage;