/**
 * Inventory Page
 * Role: Client Admin
 * Route: /client/inventory
 * Inventory and stock management
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
  Search,
  Plus,
  Package,
  AlertTriangle,
  TrendingUp,
  ArrowUpDown,
} from 'lucide-react';

interface InventoryItem {
  id: string;
  productName: string;
  sku: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  location: string;
  lastRestocked: string;
}

const mockInventory: InventoryItem[] = [
  {
    id: '1',
    productName: '20L Water Bottle',
    sku: 'WB-20L-001',
    category: 'Water Bottles',
    currentStock: 450,
    minStock: 100,
    maxStock: 1000,
    unitPrice: 15.0,
    location: 'Warehouse A',
    lastRestocked: '2024-11-10',
  },
  {
    id: '2',
    productName: '5L Water Bottle',
    sku: 'WB-5L-001',
    category: 'Water Bottles',
    currentStock: 85,
    minStock: 200,
    maxStock: 800,
    unitPrice: 8.0,
    location: 'Warehouse A',
    lastRestocked: '2024-11-08',
  },
  {
    id: '3',
    productName: 'Water Dispenser (Hot/Cold)',
    sku: 'WD-HC-001',
    category: 'Dispensers',
    currentStock: 24,
    minStock: 10,
    maxStock: 50,
    unitPrice: 120.0,
    location: 'Warehouse B',
    lastRestocked: '2024-10-25',
  },
  {
    id: '4',
    productName: '1L Water Bottle Pack (12)',
    sku: 'WB-1L-PK12',
    category: 'Retail Packs',
    currentStock: 320,
    minStock: 50,
    maxStock: 500,
    unitPrice: 12.0,
    location: 'Warehouse A',
    lastRestocked: '2024-11-12',
  },
];

const InventoryPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInventory = mockInventory.filter(
    (item) =>
      item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStockStatus = (item: InventoryItem) => {
    const stockPercentage = (item.currentStock / item.maxStock) * 100;
    if (item.currentStock <= item.minStock) {
      return { label: 'Low Stock', variant: 'destructive' as const, percentage: stockPercentage };
    }
    if (stockPercentage < 30) {
      return { label: 'Running Low', variant: 'warning' as const, percentage: stockPercentage };
    }
    return { label: 'In Stock', variant: 'success' as const, percentage: stockPercentage };
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
    { key: 'category', header: 'Category' },
    {
      key: 'currentStock',
      header: 'Stock Level',
      render: (item) => {
        const status = getStockStatus(item);
        return (
          <div className="space-y-2 w-32">
            <div className="flex items-center justify-between text-sm">
              <span>{item.currentStock}</span>
              <span className="text-muted-foreground">/ {item.maxStock}</span>
            </div>
            <Progress value={status.percentage} className="h-2" />
          </div>
        );
      },
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
      key: 'unitPrice',
      header: 'Unit Price',
      render: (item) => <span>${item.unitPrice.toFixed(2)}</span>,
    },
    { key: 'location', header: 'Location' },
  ];

  const lowStockItems = mockInventory.filter((item) => item.currentStock <= item.minStock);
  const totalValue = mockInventory.reduce(
    (sum, item) => sum + item.currentStock * item.unitPrice,
    0
  );

  return (
    <DashboardLayout title="Inventory" subtitle="Manage stock and inventory levels">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockInventory.reduce((sum, item) => sum + item.currentStock, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Units</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{lowStockItems.length}</p>
              <p className="text-sm text-muted-foreground">Low Stock Items</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <ArrowUpDown className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Inventory Value</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="p-4 mb-6 border-warning/50 bg-warning/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <div>
              <p className="font-medium">Low Stock Alert</p>
              <p className="text-sm text-muted-foreground">
                {lowStockItems.map((item) => item.productName).join(', ')} need restocking
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto">
              Restock Now
            </Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            Transfer Stock
          </Button>
          <Button variant="ocean">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filteredInventory} />
    </DashboardLayout>
  );
};

export default InventoryPage;
