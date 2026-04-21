/**
 * Customer Wallet Page
 * Route: /customer/wallet
 *
 * - Balance: fetched from /api/customer/wallet/ — handles any field name shape
 * - Transactions: derived from the customer's order list (no dedicated tx endpoint)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Wallet, Plus, ArrowUpRight, ArrowDownLeft, CreditCard,
  Loader2, AlertCircle, RefreshCw, Package,
} from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '@/api/axios.config';
import { CUSTOMER_API_ENDPOINTS } from '@/api/customerEndpoints';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderResponse {
  id: string;
  order_number: string;
  total_amount: string;
  payment_status: string;   // PAID | PENDING | REFUNDED
  payment_method: string;   // WALLET | CASH | MPESA | CREDIT
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface DerivedTransaction {
  id: string;
  kind: 'debit' | 'credit';
  amount: number;
  label: string;
  date: string;
  status: 'completed' | 'pending' | 'refunded';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Pull a numeric balance out of whatever shape the wallet endpoint returns.
 * Tries every common field name.
 */
function extractBalance(data: Record<string, unknown>): number {
  const candidates = [
    'balance', 'current_balance', 'available_balance', 'amount', 'wallet_balance',
  ];
  for (const key of candidates) {
    if (data[key] !== undefined && data[key] !== null) {
      const val = parseFloat(String(data[key]));
      if (!isNaN(val)) return val;
    }
  }
  return 0;
}

function extractOrders(data: unknown): OrderResponse[] {
  if (Array.isArray(data)) return data as OrderResponse[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as OrderResponse[];
    if (Array.isArray(obj.data))    return obj.data    as OrderResponse[];
  }
  return [];
}

/**
 * Build wallet-style transaction rows from orders.
 * Only WALLET orders appear here — CASH / MPESA / CREDIT don't touch the wallet.
 */
function deriveTransactions(orders: OrderResponse[]): DerivedTransaction[] {
  const rows: DerivedTransaction[] = [];

  for (const order of orders) {
    const amount = parseFloat(order.total_amount);
    if (isNaN(amount) || order.payment_method !== 'WALLET') continue;

    // Refunded orders generate a credit row first, then a debit row
    if (order.payment_status === 'REFUNDED') {
      rows.push({
        id:     `refund-${order.id}`,
        kind:   'credit',
        amount,
        label:  `Refund — ${order.order_number}`,
        date:   order.created_at,
        status: 'refunded',
      });
    }

    // The original payment row (debit)
    rows.push({
      id:     `pay-${order.id}`,
      kind:   'debit',
      amount,
      label:  `Order ${order.order_number}`,
      date:   order.paid_at ?? order.created_at,
      status:
        order.payment_status === 'PAID'     ? 'completed'
        : order.payment_status === 'REFUNDED' ? 'completed'   // still happened
        : 'pending',
    });
  }

  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const fmtMoney = (v: number) =>
  v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s: string) => {
  try {
    return new Date(s).toLocaleDateString('en-KE', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return s; }
};

// ── Page ──────────────────────────────────────────────────────────────────────

const WalletPage: React.FC = () => {
  const [balance,      setBalance]      = useState<number | null>(null);
  const [transactions, setTransactions] = useState<DerivedTransaction[]>([]);
  const [balLoading,   setBalLoading]   = useState(true);
  const [txLoading,    setTxLoading]    = useState(true);
  const [balError,     setBalError]     = useState(false);
  const [amount,       setAmount]       = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupOpen,    setTopupOpen]    = useState(false);

  // ── Loaders ───────────────────────────────────────────────────────────────

  const loadBalance = useCallback(async () => {
    setBalLoading(true);
    setBalError(false);
    try {
      const res = await axiosInstance.get(CUSTOMER_API_ENDPOINTS.WALLET.GET);
      setBalance(extractBalance(res.data as Record<string, unknown>));
    } catch {
      setBalError(true);
    } finally {
      setBalLoading(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await axiosInstance.get(CUSTOMER_API_ENDPOINTS.ORDERS.LIST);
      setTransactions(deriveTransactions(extractOrders(res.data)));
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalance();
    loadTransactions();
  }, [loadBalance, loadTransactions]);

  // ── Monthly stats ─────────────────────────────────────────────────────────

  const now = new Date();
  const { monthlySpent, monthlyRefunded } = transactions.reduce(
    (acc, tx) => {
      const d = new Date(tx.date);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return acc;
      if (tx.kind === 'debit'  && tx.status === 'completed') acc.monthlySpent    += tx.amount;
      if (tx.kind === 'credit' && tx.status === 'refunded')  acc.monthlyRefunded += tx.amount;
      return acc;
    },
    { monthlySpent: 0, monthlyRefunded: 0 },
  );

  // ── Top-up handler ────────────────────────────────────────────────────────

  const handleAddFunds = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) { toast.error('Please enter a valid amount'); return; }
    setTopupLoading(true);
    try {
      await axiosInstance.post(CUSTOMER_API_ENDPOINTS.WALLET.TOPUP, { amount: value });
      toast.success(`KES ${fmtMoney(value)} added to your wallet`);
      setAmount('');
      setTopupOpen(false);
      loadBalance();
      loadTransactions();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string; error?: string; non_field_errors?: string[] } } };
      const msg =
        errObj.response?.data?.detail ??
        errObj.response?.data?.error ??
        errObj.response?.data?.non_field_errors?.[0] ??
        'Top-up failed. Please try again.';
      toast.error(msg);
    } finally {
      setTopupLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <CustomerLayout title="My Wallet">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Balance card */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-6 bg-gradient-ocean text-primary-foreground">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Wallet className="h-7 w-7" />
                <span className="font-medium">Available Balance</span>
              </div>
              <button
                onClick={loadBalance}
                className="opacity-70 hover:opacity-100 transition-opacity"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {balLoading ? (
              <div className="flex items-center gap-2 mb-6 opacity-80">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : balError ? (
              <div className="mb-6">
                <p className="text-sm opacity-80 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Could not load balance
                </p>
                <button onClick={loadBalance} className="text-xs underline opacity-70 mt-1">
                  Retry
                </button>
              </div>
            ) : (
              <p className="text-4xl font-bold mb-6 tabular-nums">
                KES {fmtMoney(balance ?? 0)}
              </p>
            )}

            <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full">
                  <Plus className="h-4 w-4 mr-2" /> Add Funds
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Funds to Wallet</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Amount (KES)</Label>
                    <Input
                      type="number" min="1" placeholder="Enter amount"
                      value={amount} onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[500, 1000, 2000, 5000].map((v) => (
                      <Button key={v} variant="outline" size="sm" onClick={() => setAmount(v.toString())}>
                        {v.toLocaleString()}
                      </Button>
                    ))}
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-3 p-3 border rounded-lg mb-4">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">M-Pesa / Card</p>
                        <p className="text-sm text-muted-foreground">Choose payment on next screen</p>
                      </div>
                    </div>
                    <Button
                      variant="ocean" className="w-full"
                      onClick={handleAddFunds} disabled={topupLoading || !amount}
                    >
                      {topupLoading
                        ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processing…</>
                        : `Add KES ${amount ? parseFloat(amount).toLocaleString() : '0'}`
                      }
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </Card>

          {/* Monthly stats */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4">This Month</h3>
            {txLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowUpRight className="h-4 w-4 text-red-500" /> Spent via wallet
                  </div>
                  <span className="font-medium text-red-600 tabular-nums">
                    -{fmtMoney(monthlySpent)} KES
                  </span>
                </div>
                {monthlyRefunded > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ArrowDownLeft className="h-4 w-4 text-emerald-500" /> Refunded
                    </div>
                    <span className="font-medium text-emerald-600 tabular-nums">
                      +{fmtMoney(monthlyRefunded)} KES
                    </span>
                  </div>
                )}
                {monthlySpent === 0 && monthlyRefunded === 0 && (
                  <p className="text-sm text-muted-foreground">No wallet activity this month.</p>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Transactions */}
        <div className="lg:col-span-2">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Wallet Transactions</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Orders paid via wallet</p>
              </div>
              <button
                onClick={loadTransactions}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {txLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-3 border-b last:border-0">
                    <div className="h-9 w-9 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                      <div className="h-2.5 w-1/4 rounded bg-muted animate-pulse" />
                    </div>
                    <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                  <Package className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="font-medium text-muted-foreground">No wallet orders yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Orders paid via wallet will appear here.
                </p>
              </div>
            ) : (
              <div>
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full shrink-0 ${
                        tx.kind === 'credit' ? 'bg-emerald-50' : 'bg-red-50'
                      }`}>
                        {tx.kind === 'credit'
                          ? <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                          : <ArrowUpRight  className="h-4 w-4 text-red-600" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-sm">{tx.label}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(tx.date)}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-medium text-sm tabular-nums ${
                        tx.kind === 'credit' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {tx.kind === 'credit' ? '+' : '-'}KES {fmtMoney(tx.amount)}
                      </p>
                      <Badge
                        variant={
                          tx.status === 'completed' ? 'success'
                          : tx.status === 'refunded' ? 'secondary'
                          : 'warning'
                        }
                        className="text-xs capitalize"
                      >
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default WalletPage;