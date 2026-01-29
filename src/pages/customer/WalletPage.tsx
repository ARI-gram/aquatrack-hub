/**
 * Customer Wallet Page
 * Role: Customer
 * Route: /customer/wallet
 * Wallet balance and transactions
 */

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending';
}

const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'debit',
    amount: 61.0,
    description: 'Order #ORD-2024-045',
    date: '2024-11-14',
    status: 'completed',
  },
  {
    id: '2',
    type: 'credit',
    amount: 100.0,
    description: 'Wallet top-up',
    date: '2024-11-10',
    status: 'completed',
  },
  {
    id: '3',
    type: 'debit',
    amount: 30.0,
    description: 'Order #ORD-2024-038',
    date: '2024-11-05',
    status: 'completed',
  },
  {
    id: '4',
    type: 'credit',
    amount: 50.0,
    description: 'Wallet top-up',
    date: '2024-11-01',
    status: 'completed',
  },
];

const WalletPage: React.FC = () => {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const walletBalance = 125.0;

  const handleAddFunds = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);
    setAmount('');
    toast.success(`$${value.toFixed(2)} added to your wallet`);
  };

  return (
    <DashboardLayout title="My Wallet" subtitle="Manage your wallet balance">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="lg:col-span-1">
          <Card className="p-6 bg-gradient-ocean text-white">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="h-8 w-8" />
              <span className="font-medium">Available Balance</span>
            </div>
            <p className="text-4xl font-bold mb-6">${walletBalance.toFixed(2)}</p>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Funds
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Funds to Wallet</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Amount (USD)</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    {[25, 50, 100, 200].map((value) => (
                      <Button
                        key={value}
                        variant="outline"
                        size="sm"
                        onClick={() => setAmount(value.toString())}
                      >
                        ${value}
                      </Button>
                    ))}
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-3 p-3 border rounded-lg mb-4">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">Credit Card</p>
                        <p className="text-sm text-muted-foreground">•••• 4242</p>
                      </div>
                    </div>
                    <Button
                      variant="ocean"
                      className="w-full"
                      onClick={handleAddFunds}
                      disabled={isLoading || !amount}
                    >
                      {isLoading ? 'Processing...' : `Add $${amount || '0'}`}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </Card>

          {/* Quick Stats */}
          <Card className="p-6 mt-6">
            <h3 className="font-semibold mb-4">This Month</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowDownLeft className="h-4 w-4 text-success" />
                  Added
                </div>
                <span className="font-medium text-success">+$150.00</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowUpRight className="h-4 w-4 text-destructive" />
                  Spent
                </div>
                <span className="font-medium text-destructive">-$91.00</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Transactions */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Recent Transactions</h3>
            <div className="space-y-4">
              {mockTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-full ${
                        transaction.type === 'credit'
                          ? 'bg-success/10'
                          : 'bg-destructive/10'
                      }`}
                    >
                      {transaction.type === 'credit' ? (
                        <ArrowDownLeft className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {transaction.date}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-medium ${
                        transaction.type === 'credit'
                          ? 'text-success'
                          : 'text-destructive'
                      }`}
                    >
                      {transaction.type === 'credit' ? '+' : '-'}$
                      {transaction.amount.toFixed(2)}
                    </p>
                    <Badge
                      variant={
                        transaction.status === 'completed' ? 'success' : 'warning'
                      }
                      className="text-xs"
                    >
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WalletPage;
