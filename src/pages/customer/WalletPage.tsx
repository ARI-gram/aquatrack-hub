/**
 * Customer Wallet Page
 * Route: /customer/wallet
 */

import React, { useState } from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string; type: 'credit' | 'debit';
  amount: number; description: string;
  date: string; status: 'completed' | 'pending';
}

const mockTransactions: Transaction[] = [
  { id: '1', type: 'debit',  amount: 61,  description: 'Order #ORD-2024-045', date: '2024-11-14', status: 'completed' },
  { id: '2', type: 'credit', amount: 100, description: 'Wallet top-up',        date: '2024-11-10', status: 'completed' },
  { id: '3', type: 'debit',  amount: 30,  description: 'Order #ORD-2024-038', date: '2024-11-05', status: 'completed' },
  { id: '4', type: 'credit', amount: 50,  description: 'Wallet top-up',        date: '2024-11-01', status: 'completed' },
];

const WalletPage: React.FC = () => {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const walletBalance = 125.0;

  const handleAddFunds = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) { toast.error('Please enter a valid amount'); return; }
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsLoading(false);
    setAmount('');
    toast.success(`$${value.toFixed(2)} added to your wallet`);
  };

  return (
    <CustomerLayout title="My Wallet">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Balance card */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-6 bg-gradient-ocean text-primary-foreground">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="h-7 w-7" />
              <span className="font-medium">Available Balance</span>
            </div>
            <p className="text-4xl font-bold mb-6">${walletBalance.toFixed(2)}</p>

            <Dialog>
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
                    <Input type="number" min="1" placeholder="Enter amount"
                      value={amount} onChange={(e) => setAmount(e.target.value)} />
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
                    <Button variant="ocean" className="w-full" onClick={handleAddFunds}
                      disabled={isLoading || !amount}>
                      {isLoading ? 'Processing…' : `Add KES ${amount || '0'}`}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </Card>

          {/* Month stats */}
          <Card className="p-5">
            <h3 className="font-semibold mb-4">This Month</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <ArrowDownLeft className="h-4 w-4 text-success" /> Added
                </div>
                <span className="font-medium text-success">+$150.00</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <ArrowUpRight className="h-4 w-4 text-destructive" /> Spent
                </div>
                <span className="font-medium text-destructive">-$91.00</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Transactions */}
        <div className="lg:col-span-2">
          <Card className="p-5 sm:p-6">
            <h3 className="font-semibold mb-4">Recent Transactions</h3>
            <div className="space-y-3">
              {mockTransactions.map((tx) => (
                <div key={tx.id}
                  className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${tx.type === 'credit' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                      {tx.type === 'credit'
                        ? <ArrowDownLeft className="h-4 w-4 text-success" />
                        : <ArrowUpRight className="h-4 w-4 text-destructive" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium text-sm ${tx.type === 'credit' ? 'text-success' : 'text-destructive'}`}>
                      {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </p>
                    <Badge variant={tx.status === 'completed' ? 'success' : 'warning'} className="text-xs">
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
};

export default WalletPage;