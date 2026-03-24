/**
 * AccountantCustomersPage
 * src/pages/accounts/AccountantCustomersPage.tsx
 *
 * Read-only customer list for the accountant role.
 * Shows outstanding balances, credit status, overdue flags.
 * Tapping a customer opens their full account statement.
 *
 * Route: /client/accounts/customers
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search, X, Loader2, Users, Phone,
  AlertTriangle, ChevronRight, CreditCard,
  CheckCircle2, InboxIcon, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountsLayout } from '@/pages/accounts/AccountsLayout';
import axiosInstance from '@/api/axios.config';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerSummary {
  id:                 string;
  fullName:           string;
  phoneNumber:        string;
  email:              string | null;
  status:             string;
  creditEnabled:      boolean;
  creditLimit:        number;
  outstandingBalance: number;
  availableCredit:    number;
  hasOverdue:         boolean;
  invoiceCount:       number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ── Customer card ─────────────────────────────────────────────────────────────

const CustomerCard: React.FC<{
  customer: CustomerSummary;
  onClick:  () => void;
}> = ({ customer: c, onClick }) => {
  const creditUsedPct = c.creditLimit > 0
    ? Math.min(100, (c.outstandingBalance / c.creditLimit) * 100)
    : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border/60 bg-card p-4 hover:border-primary/30 hover:bg-primary/[0.02] active:scale-[0.98] transition-all"
    >
      <div className="flex items-start gap-3">

        {/* Avatar */}
        <div className={cn(
          'h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 font-black text-base',
          c.hasOverdue
            ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
            : c.outstandingBalance > 0
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
        )}>
          {c.fullName.trim()[0]?.toUpperCase() ?? '?'}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm truncate">{c.fullName}</p>
            {c.hasOverdue && (
              <span className="text-[9px] font-black bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 px-1.5 py-0.5 rounded-full shrink-0">
                OVERDUE
              </span>
            )}
            {c.creditEnabled && !c.hasOverdue && (
              <span className="text-[9px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5">
                <CreditCard className="h-2.5 w-2.5" /> CREDIT
              </span>
            )}
          </div>

          {c.phoneNumber && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3 shrink-0" />{c.phoneNumber}
            </p>
          )}

          {/* Outstanding balance */}
          {c.outstandingBalance > 0 ? (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Outstanding</span>
                <span className={cn(
                  'font-bold tabular-nums',
                  c.hasOverdue ? 'text-red-600' : 'text-amber-600',
                )}>
                  {fmtMoney(c.outstandingBalance)}
                </span>
              </div>
              {c.creditEnabled && c.creditLimit > 0 && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      creditUsedPct >= 100 ? 'bg-red-600' :
                      creditUsedPct >= 80  ? 'bg-orange-500' :
                      creditUsedPct >= 50  ? 'bg-amber-400' :
                                             'bg-blue-500',
                    )}
                    style={{ width: `${Math.min(100, creditUsedPct)}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-[11px] text-emerald-600 font-semibold">No outstanding balance</span>
            </div>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
      </div>
    </button>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const AccountantCustomersPage: React.FC = () => {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [filtered,  setFiltered]  = useState<CustomerSummary[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState('');
  const [filter,    setFilter]    = useState<'all' | 'outstanding' | 'overdue' | 'credit'>('all');

  // Fetch customers with their payment profile data
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Use the existing customers endpoint + payment profile data
      const { data } = await axiosInstance.get('/customers/', {
        params: { limit: 200, include_balance: true },
      });

      const raw = (data.data ?? data ?? []) as {
        id: string;
        full_name: string;
        phone_number: string;
        email: string | null;
        status: string;
        payment_profile?: {
          credit_account_enabled: boolean;
          credit_limit:           number;
          outstanding_balance:    number;
          available_credit:       number;
        };
        invoices_count?: number;
        has_overdue?:   boolean;
      }[];

      const mapped: CustomerSummary[] = raw.map(c => ({
        id:                 c.id,
        fullName:           c.full_name,
        phoneNumber:        c.phone_number,
        email:              c.email,
        status:             c.status,
        creditEnabled:      c.payment_profile?.credit_account_enabled ?? false,
        creditLimit:        Number(c.payment_profile?.credit_limit ?? 0),
        outstandingBalance: Number(c.payment_profile?.outstanding_balance ?? 0),
        availableCredit:    Number(c.payment_profile?.available_credit ?? 0),
        hasOverdue:         c.has_overdue ?? false,
        invoiceCount:       c.invoices_count ?? 0,
      }));

      // Sort: overdue first, then outstanding, then alphabetical
      mapped.sort((a, b) => {
        if (a.hasOverdue  && !b.hasOverdue)  return -1;
        if (!a.hasOverdue && b.hasOverdue)   return 1;
        if (b.outstandingBalance !== a.outstandingBalance)
          return b.outstandingBalance - a.outstandingBalance;
        return a.fullName.localeCompare(b.fullName);
      });

      setCustomers(mapped);
      setFiltered(mapped);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Apply search + filter
  useEffect(() => {
    let list = [...customers];

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c =>
        c.fullName.toLowerCase().includes(q) ||
        c.phoneNumber.includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
      );
    }

    switch (filter) {
      case 'outstanding':
        list = list.filter(c => c.outstandingBalance > 0);
        break;
      case 'overdue':
        list = list.filter(c => c.hasOverdue);
        break;
      case 'credit':
        list = list.filter(c => c.creditEnabled);
        break;
    }

    setFiltered(list);
  }, [query, filter, customers]);

  // Stats
  const totalOutstanding = customers.reduce((s, c) => s + c.outstandingBalance, 0);
  const overdueCount     = customers.filter(c => c.hasOverdue).length;
  const creditCount      = customers.filter(c => c.creditEnabled).length;

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'all',         label: `All (${customers.length})` },
    { key: 'outstanding', label: `Outstanding (${customers.filter(c => c.outstandingBalance > 0).length})` },
    { key: 'overdue',     label: `Overdue (${overdueCount})` },
    { key: 'credit',      label: `Credit (${creditCount})` },
  ];

  return (
    <AccountsLayout title="Customers" subtitle="Balances & account statements">
      <div className="max-w-2xl mx-auto space-y-4 pb-10">

        {/* Stats strip */}
        {!loading && (
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: 'Total Outstanding',
                value: fmtMoney(totalOutstanding),
                color: totalOutstanding > 0 ? 'text-amber-600' : 'text-emerald-600',
                bg:    totalOutstanding > 0 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/60',
              },
              {
                label: 'Overdue Accounts',
                value: String(overdueCount),
                color: overdueCount > 0 ? 'text-red-600' : 'text-emerald-600',
                bg:    overdueCount > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200/60 dark:border-red-800/40' : 'bg-muted/40 border-border/60',
              },
              {
                label: 'Credit Customers',
                value: String(creditCount),
                color: 'text-blue-600',
                bg:    'bg-blue-50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40',
              },
            ].map(s => (
              <div key={s.label} className={cn('rounded-2xl border p-3 text-center', s.bg)}>
                <p className={cn('font-black text-base tabular-nums', s.color)}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + refresh */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full h-11 pl-10 pr-9 rounded-xl border border-border/60 bg-muted/30 text-sm focus:outline-none focus:border-primary/40"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={load}
            className="h-11 w-11 flex items-center justify-center rounded-xl border border-border/60 bg-muted/30 hover:bg-muted transition-colors shrink-0"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'shrink-0 text-[11px] font-bold px-3.5 py-2 rounded-full border-2 transition-all',
                filter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 text-muted-foreground border-border/40 hover:border-border',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/50" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border-2 border-dashed border-border/40">
            {query || filter !== 'all'
              ? <><Search className="h-8 w-8 text-muted-foreground/20" /><p className="text-sm text-muted-foreground">No customers match your search</p></>
              : <><Users className="h-8 w-8 text-muted-foreground/20" /><p className="text-sm text-muted-foreground">No customers yet</p></>
            }
            {(query || filter !== 'all') && (
              <button
                onClick={() => { setQuery(''); setFilter('all'); }}
                className="text-xs text-primary underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1">
              {filtered.length} customer{filtered.length !== 1 ? 's' : ''}
              {query && ` matching "${query}"`}
            </p>
            {filtered.map(c => (
              <CustomerCard
                key={c.id}
                customer={c}
                onClick={() => navigate(`/client/accounts/customers/${c.id}/statement`)}
              />
            ))}
          </div>
        )}

      </div>
    </AccountsLayout>
  );
};

export default AccountantCustomersPage;