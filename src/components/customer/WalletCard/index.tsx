/**
 * WalletCard Component
 * Displays wallet balance and quick actions
 */
// /src/components/customer/WalletCard/index.tsx
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, Plus, Settings, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CustomerWallet, WalletTransaction } from '@/types/wallet.types';
import { WALLET_LIMITS, CUSTOMER_PRICING } from '@/constants/pricing';

interface WalletCardProps {
  wallet: CustomerWallet;
  recentTransactions?: WalletTransaction[];
  onTopUp?: (amount: number) => Promise<void>;
  compact?: boolean;
}

export const WalletCard: React.FC<WalletCardProps> = ({
  wallet,
  recentTransactions = [],
  onTopUp,
  compact = false,
}) => {
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleQuickTopUp = async (amount: number) => {
    if (onTopUp) {
      setIsLoading(true);
      try {
        await onTopUp(amount);
        setIsTopUpOpen(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCustomTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (amount >= WALLET_LIMITS.MIN_TOPUP && amount <= WALLET_LIMITS.MAX_TOPUP) {
      await handleQuickTopUp(amount);
      setTopUpAmount('');
    }
  };

  if (compact) {
    return (
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <Wallet className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Wallet Balance</p>
            <p className="text-xl font-bold">
              {CUSTOMER_PRICING.CURRENCY_SYMBOL}{wallet.balance.toFixed(2)}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setIsTopUpOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <div className="inline-flex p-3 rounded-full bg-success/10 mb-3">
          <Wallet className="h-8 w-8 text-success" />
        </div>
        <p className="text-sm text-muted-foreground">Current Balance</p>
        <p className="text-4xl font-bold mt-1">
          {CUSTOMER_PRICING.CURRENCY_SYMBOL}{wallet.balance.toFixed(2)}
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
          <DialogTrigger asChild>
            <Button variant="ocean" className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Add Funds
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Top Up Wallet</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Quick Add</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {WALLET_LIMITS.QUICK_TOPUP_AMOUNTS.map((amount) => (
                    <Button
                      key={amount}
                      variant="outline"
                      onClick={() => handleQuickTopUp(amount)}
                      disabled={isLoading}
                    >
                      +${amount}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="customAmount">Custom Amount</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="customAmount"
                    type="number"
                    placeholder={`$${WALLET_LIMITS.MIN_TOPUP} - $${WALLET_LIMITS.MAX_TOPUP}`}
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    min={WALLET_LIMITS.MIN_TOPUP}
                    max={WALLET_LIMITS.MAX_TOPUP}
                  />
                  <Button onClick={handleCustomTopUp} disabled={isLoading}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Button variant="outline">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {recentTransactions.length > 0 && (
        <div>
          <h4 className="font-medium text-sm text-muted-foreground mb-3">
            Recent Transactions
          </h4>
          <div className="space-y-3">
            {recentTransactions.slice(0, 3).map((txn) => (
              <TransactionItem key={txn.transactionId} transaction={txn} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

interface TransactionItemProps {
  transaction: WalletTransaction;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const isCredit = transaction.amount > 0;
  
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={`p-1.5 rounded-lg ${isCredit ? 'bg-success/10' : 'bg-muted'}`}>
          {isCredit ? (
            <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{transaction.description}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(transaction.timestamp).toLocaleDateString()}
          </p>
        </div>
      </div>
      <span className={`font-medium ${isCredit ? 'text-success' : ''}`}>
        {isCredit ? '+' : ''}{CUSTOMER_PRICING.CURRENCY_SYMBOL}
        {Math.abs(transaction.amount).toFixed(2)}
      </span>
    </div>
  );
};

export default WalletCard;
