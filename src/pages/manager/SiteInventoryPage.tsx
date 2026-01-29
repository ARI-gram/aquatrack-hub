/**
 * Site Inventory Page
 * Role: Site Manager
 * Route: /manager/inventory
 * View and manage site-specific inventory
 */

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Search,
  Package,
  AlertTriangle,
  Plus,
  Minus,
} from 'lucide-react';
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  productName: string;
  sku: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  reserved: number;
  available: number;
}

const mockInventory: InventoryItem[] = [
  {
    id: '1',
    productName: '20L Water Bottle',
    sku: 'WB-20L-001',
    currentStock: 150,
    minStock: 50,
    maxStock: 300,
    reserved: 25,
    available: 125,
  },
  {
    id: '2',
    productName: '5L Water Bottle',
    sku: 'WB-5L-001',
    currentStock: 35,
    minStock: 100,
    maxStock: 400,
    reserved: 10,
    available: 25,
  },
  {
    id: '3',
    productName: '1L Water Pack (12)',
    sku: 'WB-1L-PK12',
    currentStock: 200,
    minStock: 50,
    maxStock: 300,
    reserved: 30,
    available: 170,
  },
];

const SiteInventoryPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [adjustmentItem, setAdjustmentItem] = useState<InventoryItem | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');

  const filteredInventory = mockInventory.filter(
    (item) =>
      item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock <= item.minStock) {
      return { label: 'Low Stock', variant: 'destructive' as const };
    }
    if (item.currentStock < item.minStock * 1.5) {
      return { label: 'Running Low', variant: 'warning' as const };
    }
    return { label: 'In Stock', variant: 'success' as const };
  };

  const handleAdjustment = () => {
    if (!adjustmentItem || adjustmentQty <= 0) return;
    
    toast.success(
      `${adjustmentType === 'add' ? 'Added' : 'Removed'} ${adjustmentQty} units ${
        adjustmentType === 'add' ? 'to' : 'from'
      } ${adjustmentItem.productName}`
    );
    setAdjustmentItem(null);
    setAdjustmentQty(0);
  };

  const columns: Column<InventoryItem>[] = [
    {
      key: 'productName',
      header: 'Product',
      render: (item) => (
        <div>
          <p className="font-medium">{item.productName}</p>
          <p className="text-sm text-muted-foreground font-mono">{item.sku}</p>
        </div>
      ),
    },
    {
      key: 'currentStock',
      header: 'Stock Level',
      render: (item) => {
        const percentage = (item.currentStock / item.maxStock) * 100;
        return (
          <div className="space-y-1 w-32">
            <div className="flex items-center justify-between text-sm">
              <span>{item.currentStock}</span>
              <span className="text-muted-foreground">/ {item.maxStock}</span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        );
      },
    },
    {
      key: 'reserved',
      header: 'Reserved',
      render: (item) => <span className="text-warning">{item.reserved}</span>,
    },
    {
      key: 'available',
      header: 'Available',
      render: (item) => <span className="font-medium">{item.available}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => {
        const status = getStockStatus(item);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdjustmentItem(item);
                  setAdjustmentType('add');
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adjust Stock: {item.productName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-4">
                  <Button
                    variant={adjustmentType === 'add' ? 'default' : 'outline'}
                    onClick={() => setAdjustmentType('add')}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stock
                  </Button>
                  <Button
                    variant={adjustmentType === 'remove' ? 'default' : 'outline'}
                    onClick={() => setAdjustmentType('remove')}
                    className="flex-1"
                  >
                    <Minus className="h-4 w-4 mr-2" />
                    Remove Stock
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={adjustmentQty}
                    onChange={(e) => setAdjustmentQty(parseInt(e.target.value) || 0)}
                  />
                </div>
                <Button
                  variant="ocean"
                  className="w-full"
                  onClick={handleAdjustment}
                  disabled={adjustmentQty <= 0}
                >
                  Confirm Adjustment
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ),
    },
  ];

  const lowStockCount = mockInventory.filter(
    (item) => item.currentStock <= item.minStock
  ).length;

  return (
    <DashboardLayout title="Site Inventory" subtitle="Manage your location's stock">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockInventory.length}</p>
              <p className="text-sm text-muted-foreground">Products</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Package className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockInventory.reduce((sum, item) => sum + item.available, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Available Units</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{lowStockCount}</p>
              <p className="text-sm text-muted-foreground">Low Stock Items</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <Card className="p-4 mb-6 border-warning/50 bg-warning/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <div>
              <p className="font-medium">Low Stock Alert</p>
              <p className="text-sm text-muted-foreground">
                {lowStockCount} item(s) are running low on stock. Request restocking
                from the main warehouse.
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto">
              Request Stock
            </Button>
          </div>
        </Card>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filteredInventory} />
    </DashboardLayout>
  );
};

export default SiteInventoryPage;
