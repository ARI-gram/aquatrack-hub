/**
 * Client Management Page
 * Role: Super Admin
 * Route: /admin/clients
 * Manages all client (distributor) accounts
 */

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Plus,
  Search,
  MoreHorizontal,
  Building2,
  Users,
  Package,
  TrendingUp,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: string;
  status: 'active' | 'inactive' | 'trial';
  totalOrders: number;
  employees: number;
  createdAt: string;
}

// Mock data
const mockClients: Client[] = [
  {
    id: '1',
    name: 'Pure Water Co.',
    email: 'admin@purewater.com',
    phone: '+1 555-0101',
    plan: 'Enterprise',
    status: 'active',
    totalOrders: 15420,
    employees: 24,
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Crystal Springs',
    email: 'contact@crystalsprings.com',
    phone: '+1 555-0102',
    plan: 'Professional',
    status: 'active',
    totalOrders: 8932,
    employees: 12,
    createdAt: '2024-02-20',
  },
  {
    id: '3',
    name: 'Mountain Fresh',
    email: 'info@mountainfresh.com',
    phone: '+1 555-0103',
    plan: 'Starter',
    status: 'trial',
    totalOrders: 234,
    employees: 4,
    createdAt: '2024-11-01',
  },
  {
    id: '4',
    name: 'Aqua Solutions',
    email: 'support@aquasol.com',
    phone: '+1 555-0104',
    plan: 'Professional',
    status: 'inactive',
    totalOrders: 5621,
    employees: 8,
    createdAt: '2024-03-10',
  },
];

const ClientManagementPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = mockClients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: Client['status']) => {
    const variants: Record<Client['status'], 'success' | 'destructive' | 'warning'> = {
      active: 'success',
      inactive: 'destructive',
      trial: 'warning',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Company',
      render: (client) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">{client.name}</p>
            <p className="text-sm text-muted-foreground">{client.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'plan', header: 'Plan' },
    {
      key: 'status',
      header: 'Status',
      render: (client) => getStatusBadge(client.status),
    },
    {
      key: 'totalOrders',
      header: 'Total Orders',
      render: (client) => client.totalOrders.toLocaleString(),
    },
    {
      key: 'employees',
      header: 'Employees',
      render: (client) => (
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          {client.employees}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (client) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Edit Client</DropdownMenuItem>
            <DropdownMenuItem>View Billing</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Suspend Account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DashboardLayout title="Client Management" subtitle="Manage distributor accounts">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockClients.length}</p>
              <p className="text-sm text-muted-foreground">Total Clients</p>
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
                {mockClients.filter((c) => c.status === 'active').length}
              </p>
              <p className="text-sm text-muted-foreground">Active Clients</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Package className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockClients.reduce((sum, c) => sum + c.totalOrders, 0).toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Total Orders</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockClients.reduce((sum, c) => sum + c.employees, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="ocean">
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filteredClients} />
    </DashboardLayout>
  );
};

export default ClientManagementPage;
