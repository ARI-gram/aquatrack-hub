/**
 * Customer Bottles Page
 * Dedicated page for bottle inventory management
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { BottleTracker } from '@/components/customer/BottleTracker';
import { BottleHistory } from '@/components/customer/BottleTracker/BottleHistory';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import { CUSTOMER_PRICING } from '@/constants/pricing';
import { BottleTransactionType, type BottleInventory, type BottleActivityItem } from '@/types/bottle.types';
import {
  Plus,
  Info,
  RefreshCw,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';

// Mock data
const mockInventory: BottleInventory = {
  customerId: 'customer-001',
  totalOwned: 10,
  fullBottles: 3,
  emptyBottles: 5,
  inTransit: 2,
  atDistributor: 0,
  depositPerBottle: CUSTOMER_PRICING.BOTTLE_DEPOSIT,
  totalDeposit: 10 * CUSTOMER_PRICING.BOTTLE_DEPOSIT,
  lastUpdated: new Date().toISOString(),
};

const mockHistory: BottleActivityItem[] = [
  {
    id: '1',
    date: '2024-01-30',
    type: BottleTransactionType.REFILL_DELIVERED,
    quantity: 5,
    orderNumber: 'ORD-12345',
    status: 'IN_TRANSIT',
    description: 'Refill delivery in progress',
  },
  {
    id: '2',
    date: '2024-01-28',
    type: BottleTransactionType.REFILL_DELIVERED,
    quantity: 3,
    orderNumber: 'ORD-12340',
    status: 'COMPLETED',
    description: 'Refill delivery completed',
  },
  {
    id: '3',
    date: '2024-01-25',
    type: BottleTransactionType.PURCHASE,
    quantity: 5,
    orderNumber: 'ORD-12335',
    status: 'COMPLETED',
    description: 'Purchased 5 new bottles',
  },
  {
    id: '4',
    date: '2024-01-20',
    type: BottleTransactionType.REFILL_DELIVERED,
    quantity: 4,
    orderNumber: 'ORD-12330',
    status: 'COMPLETED',
    description: 'Refill delivery completed',
  },
];

const BottlesPage: React.FC = () => {
  const navigate = useNavigate();
  
  const totalDeposit = mockInventory.totalOwned * mockInventory.depositPerBottle;

  return (
    <CustomerLayout title="My Bottles">
      <div className="space-y-6">
        {/* Bottle Tracker */}
        <BottleTracker inventory={mockInventory} />

        {/* Deposit Info */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="font-medium">Deposit on File</p>
                <p className="text-sm text-muted-foreground">
                  ${mockInventory.depositPerBottle} per bottle × {mockInventory.totalOwned} bottles
                </p>
              </div>
            </div>
            <span className="text-xl font-bold text-success">${totalDeposit}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            💡 Deposit is refundable when bottles are returned in good condition
          </p>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="ocean"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate(CUSTOMER_ROUTES.PLACE_ORDER)}
          >
            <RefreshCw className="h-5 w-5" />
            <span>Order Refill</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate(CUSTOMER_ROUTES.PLACE_ORDER)}
          >
            <Plus className="h-5 w-5" />
            <span>Buy Bottles</span>
          </Button>
        </div>

        {/* Low bottles warning */}
        {mockInventory.emptyBottles <= 2 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You're running low on empty bottles! Order a refill soon to keep the water flowing.
            </AlertDescription>
          </Alert>
        )}

        {/* Bottle History */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Bottle Activity</h3>
            <Badge variant="secondary">{mockHistory.length} transactions</Badge>
          </div>
          <BottleHistory activities={mockHistory} />
        </div>

        {/* Info Card */}
        <Card className="p-4 bg-muted/50">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">How bottle tracking works</p>
              <ul className="space-y-1">
                <li>• <strong>Full bottles</strong> contain fresh water ready to use</li>
                <li>• <strong>Empty bottles</strong> can be exchanged for refills</li>
                <li>• <strong>In transit</strong> bottles are being delivered or collected</li>
                <li>• Your deposit is protected while bottles are in good condition</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </CustomerLayout>
  );
};

export default BottlesPage;
