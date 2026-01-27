import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  Download,
  MoreHorizontal,
  Wallet,
  Mail,
  Phone,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  walletBalance: number;
  creditLimit: number;
  creditUsed: number;
  totalOrders: number;
  status: 'active' | 'inactive';
}

const mockCustomers: Customer[] = [
  {
    id: '1',
    name: 'ABC Corporation',
    email: 'orders@abccorp.com',
    phone: '(555) 123-4567',
    address: '123 Business Ave, Suite 100',
    walletBalance: 1250.00,
    creditLimit: 5000,
    creditUsed: 2340,
    totalOrders: 156,
    status: 'active',
  },
  {
    id: '2',
    name: 'XYZ Industries',
    email: 'purchasing@xyz.com',
    phone: '(555) 987-6543',
    address: '456 Industrial Park',
    walletBalance: 0,
    creditLimit: 3000,
    creditUsed: 1200,
    totalOrders: 89,
    status: 'active',
  },
  {
    id: '3',
    name: 'Downtown Office Complex',
    email: 'admin@downtown.com',
    phone: '(555) 456-7890',
    address: '789 Main Street',
    walletBalance: 3400.50,
    creditLimit: 0,
    creditUsed: 0,
    totalOrders: 234,
    status: 'active',
  },
  {
    id: '4',
    name: 'Green Valley Gym',
    email: 'manager@greenvalley.com',
    phone: '(555) 321-0987',
    address: '321 Fitness Blvd',
    walletBalance: 150.00,
    creditLimit: 1000,
    creditUsed: 950,
    totalOrders: 45,
    status: 'inactive',
  },
];

const customerColumns: Column<Customer>[] = [
  {
    key: 'name',
    header: 'Customer',
    render: (customer) => (
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-ocean flex items-center justify-center text-white font-semibold">
          {customer.name[0]}
        </div>
        <div>
          <p className="font-semibold text-foreground">{customer.name}</p>
          <p className="text-xs text-muted-foreground">{customer.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'phone',
    header: 'Contact',
    render: (customer) => (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Phone className="h-3.5 w-3.5" />
        <span className="text-sm">{customer.phone}</span>
      </div>
    ),
  },
  {
    key: 'walletBalance',
    header: 'Wallet',
    render: (customer) => (
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-success" />
        <span className={`font-medium ${customer.walletBalance > 0 ? 'text-success' : 'text-muted-foreground'}`}>
          ${customer.walletBalance.toFixed(2)}
        </span>
      </div>
    ),
  },
  {
    key: 'creditUsed',
    header: 'Credit',
    render: (customer) => {
      if (customer.creditLimit === 0) return <span className="text-muted-foreground">N/A</span>;
      const usage = (customer.creditUsed / customer.creditLimit) * 100;
      return (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>${customer.creditUsed}</span>
            <span className="text-muted-foreground">/ ${customer.creditLimit}</span>
          </div>
          <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${usage > 80 ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${usage}%` }}
            />
          </div>
        </div>
      );
    },
  },
  {
    key: 'totalOrders',
    header: 'Orders',
    render: (customer) => (
      <span className="font-medium text-foreground">{customer.totalOrders}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (customer) => (
      <Badge variant={customer.status === 'active' ? 'success' : 'secondary'}>
        {customer.status}
      </Badge>
    ),
  },
  {
    key: 'actions',
    header: '',
    render: () => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>View Details</DropdownMenuItem>
          <DropdownMenuItem>Edit Customer</DropdownMenuItem>
          <DropdownMenuItem>Manage Wallet</DropdownMenuItem>
          <DropdownMenuItem>Adjust Credit</DropdownMenuItem>
          <DropdownMenuItem>View Orders</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export const CustomersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = mockCustomers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout
      title="Customers"
      subtitle="Manage customer accounts and balances"
    >
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Customers</p>
            <p className="text-2xl font-bold text-foreground">248</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-success">231</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Wallet Balance</p>
            <p className="text-2xl font-bold text-foreground">$45,230</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Outstanding Credit</p>
            <p className="text-2xl font-bold text-warning">$12,450</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <Card className="mb-6 border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="gap-2 flex-1 md:flex-initial">
                <Mail className="h-4 w-4" />
                Email All
              </Button>
              <Button variant="outline" className="gap-2 flex-1 md:flex-initial">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button variant="ocean" className="gap-2 flex-1 md:flex-initial">
                <Plus className="h-4 w-4" />
                Add Customer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <DataTable
        columns={customerColumns}
        data={filteredCustomers}
        onRowClick={(customer) => console.log('View customer:', customer.id)}
        emptyMessage="No customers found"
      />
    </DashboardLayout>
  );
};
