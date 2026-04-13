/**
 * Customer Bottles Page
 * Dedicated page for bottle inventory management
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { BottleTracker } from '@/components/customer/BottleTracker';
import { BottleHistory } from '@/components/customer/BottleTracker/BottleHistory';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import { bottleService } from '@/api/services/bottle.service';
import type { AxiosError } from 'axios';
import { type BottleInventory, type BottleActivityItem } from '@/types/bottle.types';
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

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const BottlesPageSkeleton: React.FC = () => (
  <div className="space-y-6">
    <Skeleton className="h-40 w-full rounded-2xl" />
    <Skeleton className="h-20 w-full rounded-xl" />
    <div className="grid grid-cols-2 gap-3">
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
    </div>
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const BottlesPage: React.FC = () => {
  const navigate = useNavigate();

  const [inventory, setInventory] = useState<BottleInventory | null>(null);
  const [activities, setActivities] = useState<BottleActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inv, hist] = await Promise.all([
        bottleService.getInventory(),
        bottleService.getHistory({ limit: 20 }),
      ]);
      setInventory(inv);
      setActivities(hist.activities);
    } catch (err) {
      const axiosErr = err as AxiosError<{ detail?: string }>;
      const message =
        axiosErr?.response?.data?.detail ??
        axiosErr?.message ??
        'Could not load bottle data. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Render: loading ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <CustomerLayout title="My Bottles">
        <BottlesPageSkeleton />
      </CustomerLayout>
    );
  }

  // ── Render: error ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <CustomerLayout title="My Bottles">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4 w-full" onClick={fetchData}>
          Try Again
        </Button>
      </CustomerLayout>
    );
  }

  // ── Render: no inventory (edge case) ────────────────────────────────────────
  if (!inventory) {
    return (
      <CustomerLayout title="My Bottles">
        <p className="text-center text-muted-foreground py-12">
          No bottle inventory found.
        </p>
      </CustomerLayout>
    );
  }

  const totalDeposit = inventory.totalOwned * inventory.depositPerBottle;

  // ── Render: main ────────────────────────────────────────────────────────────
  return (
    <CustomerLayout title="My Bottles">
      <div className="space-y-6">

        {/* Bottle Tracker */}
        <BottleTracker inventory={inventory} />

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
                  ${inventory.depositPerBottle} per bottle × {inventory.totalOwned} bottles
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
        {inventory.emptyBottles <= 2 && (
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
            <Badge variant="secondary">{activities.length} transactions</Badge>
          </div>
          <BottleHistory activities={activities} />
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