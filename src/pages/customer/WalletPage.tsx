/**
 * Customer Wallet Page
 * Route: /customer/wallet
 */

import React, { useEffect, useState, useCallback } from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, CreditCard, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  walletService,
  type CustomerWallet,
  type WalletTransaction,
  type TopUpRequest,
} from '@/api/services/wallet.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: string | number) =>
  parseFloat(String(n)).toLocaleString('en-KE', { minimumFractionDigits: 2 });

// Compute "this month" totals from the full transaction list
function monthSummary(transactions: WalletTransaction[]) {
  const now = new Date();
  const thisMonth = transactions.filter((tx) => {
    const d = new Date(tx.created_at);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      tx.status === 'COMPLETED'
    );
  });

  let added = 0;
  let spent = 0;

  for (const tx of thisMonth) {
    const amt = parseFloat(tx.amount);
    if (walletService.isCredit(tx)) added += amt;
    else spent += amt;
  }

  return { added, spent };
}

// ── Component ─────────────────────────────────────────────────────────────────

const WalletPage: React.FC = () => {
  const [wallet, setWallet] = useState<CustomerWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [topUpAmount, setTopUpAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<TopUpRequest['payment_method']>('MPESA');
  const [paymentReference, setPaymentReference] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [w, txs] = await Promise.all([
        walletService.getWallet(),
        walletService.getTransactions({ limit: 50 }),
      ]);
      setWallet(w);
      setTransactions(txs);
    } catch (err) {
      console.error('Failed to load wallet:', err);
      setLoadError('Could not load your wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTopUp = async () => {
    const value = parseFloat(topUpAmount);
    if (isNaN(value) || value < 10) {
      toast.error('Minimum top-up is KES 10.00');
      return;
    }
    if (value > 50000) {
      toast.error('Maximum top-up is KES 50,000.00');
      return;
    }

    setIsSubmitting(true);
    try {
      await walletService.topUp({
        amount: value.toFixed(2),
        payment_method: paymentMethod,
        payment_reference: paymentReference || undefined,
      });

      toast.success(`KES ${fmt(value)} added to your wallet`);
      setDialogOpen(false);
      setTopUpAmount('');
      setPaymentReference('');

      // Refresh wallet + transactions after top-up
      await fetchData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { amount?: string[] } } })
          ?.response?.data?.amount?.[0] ?? 'Top-up failed. Please try again.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const { added, spent } = monthSummary(transactions);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <CustomerLayout title="My Wallet">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </CustomerLayout>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (loadError || !wallet) {
    return (
      <CustomerLayout title="My Wallet">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{loadError ?? 'Something went wrong.'}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4 w-full" onClick={fetchData}>
          Retry
        </Button>
      </CustomerLayout>
    );
  }

  // ── Low balance banner ─────────────────────────────────────────────────────
  const showLowBalanceBanner =
    wallet.low_balance_alert_enabled && wallet.needs_low_balance_alert;

  return (
    <CustomerLayout title="My Wallet">

      {showLowBalanceBanner && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your balance is low (KES {fmt(wallet.current_balance)}). Consider topping up soon.
          </AlertDescription>
        </Alert>
      )}

      {wallet.is_locked && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your wallet is currently locked. Please contact support.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Balance card */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-6 bg-gradient-ocean text-primary-foreground">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="h-7 w-7" />
              <span className="font-medium">Available Balance</span>
            </div>
            <p className="text-4xl font-bold mb-6">KES {fmt(wallet.current_balance)}</p>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={wallet.is_locked || !wallet.is_active}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Funds
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Funds to Wallet</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">

                  <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Manual top-up:</strong> After submitting, send your payment via M-Pesa
                      or bank transfer to your distributor. Your balance will be updated once
                      payment is confirmed by the team.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>Amount (KES)</Label>
                    <Input
                      type="number"
                      min="10"
                      max="50000"
                      placeholder="Enter amount"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Min: KES 10 · Max: KES 50,000</p>
                  </div>

                  {/* Quick-select amounts */}
                  <div className="flex gap-2 flex-wrap">
                    {[500, 1000, 2000, 5000].map((v) => (
                      <Button
                        key={v}
                        variant="outline"
                        size="sm"
                        onClick={() => setTopUpAmount(v.toString())}
                      >
                        {v.toLocaleString()}
                      </Button>
                    ))}
                  </div>

                  {/* Payment method */}
                  <div className="space-y-2">
                    <Label>Payment Method</Label>
                    <Select
                      value={paymentMethod}
                      onValueChange={(v) => setPaymentMethod(v as TopUpRequest['payment_method'])}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MPESA">M-Pesa</SelectItem>
                        <SelectItem value="CARD">Card</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reference (optional but useful for M-Pesa / bank) */}
                  {(paymentMethod === 'MPESA' || paymentMethod === 'BANK_TRANSFER') && (
                    <div className="space-y-2">
                      <Label>
                        {paymentMethod === 'MPESA' ? 'M-Pesa Transaction Code' : 'Bank Reference'}
                        <span className="text-muted-foreground ml-1">(optional)</span>
                      </Label>
                      <Input
                        placeholder={paymentMethod === 'MPESA' ? 'e.g. QHX7ABCD1' : 'e.g. TRF123456'}
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-3 p-3 border rounded-lg mb-4">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">{paymentMethod.replace('_', ' ')}</p>
                        <p className="text-sm text-muted-foreground">
                          {paymentMethod === 'MPESA'
                            ? 'Send to the Paybill number shown at checkout'
                            : 'Payment confirmed by your distributor'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ocean"
                      className="w-full"
                      onClick={handleTopUp}
                      disabled={isSubmitting || !topUpAmount}
                    >
                      {isSubmitting ? 'Processing…' : `Add KES ${topUpAmount || '0'}`}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </Card>

          {/* Month stats — computed from real transactions */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4">This Month</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <ArrowDownLeft className="h-4 w-4 text-success" /> Added
                </div>
                <span className="font-medium text-success">+KES {fmt(added)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <ArrowUpRight className="h-4 w-4 text-destructive" /> Spent
                </div>
                <span className="font-medium text-destructive">-KES {fmt(spent)}</span>
              </div>
              {wallet.daily_limit && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Daily limit</span>
                  <span className="text-sm font-medium">KES {fmt(wallet.daily_limit)}</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Transactions */}
        <div className="lg:col-span-2">
          <Card className="p-5 sm:p-6">
            <h3 className="font-semibold mb-4">Recent Transactions</h3>

            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No transactions yet.
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => {
                  const isCredit = walletService.isCredit(tx);
                  const signedAmt = parseFloat(tx.signed_amount);
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isCredit ? 'bg-success/10' : 'bg-destructive/10'}`}>
                          {isCredit
                            ? <ArrowDownLeft className="h-4 w-4 text-success" />
                            : <ArrowUpRight className="h-4 w-4 text-destructive" />}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-medium text-sm ${isCredit ? 'text-success' : 'text-destructive'}`}>
                          {signedAmt >= 0 ? '+' : ''}KES {fmt(Math.abs(signedAmt))}
                        </p>
                        <Badge
                          variant={tx.status === 'COMPLETED' ? 'success' : tx.status === 'PENDING' ? 'warning' : 'destructive'}
                          className="text-xs"
                        >
                          {tx.status_display}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default WalletPage;