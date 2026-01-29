/**
 * Invoices Page
 * Role: Client Admin
 * Route: /client/invoices
 * Invoice management and generation
 */

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Download,
  Send,
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string;
  items: number;
}

const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    customerId: 'c1',
    customerName: 'ABC Corporation',
    amount: 1250.0,
    status: 'paid',
    issueDate: '2024-11-01',
    dueDate: '2024-11-15',
    items: 5,
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    customerId: 'c2',
    customerName: 'XYZ Industries',
    amount: 3450.0,
    status: 'sent',
    issueDate: '2024-11-05',
    dueDate: '2024-11-19',
    items: 12,
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-003',
    customerId: 'c3',
    customerName: 'Downtown Office',
    amount: 890.0,
    status: 'overdue',
    issueDate: '2024-10-20',
    dueDate: '2024-11-03',
    items: 3,
  },
  {
    id: '4',
    invoiceNumber: 'INV-2024-004',
    customerId: 'c4',
    customerName: 'Tech Solutions',
    amount: 2100.0,
    status: 'draft',
    issueDate: '2024-11-10',
    dueDate: '2024-11-24',
    items: 8,
  },
];

const InvoicesPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredInvoices = mockInvoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Invoice['status']) => {
    const config: Record<
      Invoice['status'],
      { variant: 'secondary' | 'info' | 'success' | 'destructive'; icon: React.ReactNode }
    > = {
      draft: { variant: 'secondary', icon: <FileText className="h-3 w-3 mr-1" /> },
      sent: { variant: 'info', icon: <Send className="h-3 w-3 mr-1" /> },
      paid: { variant: 'success', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      overdue: { variant: 'destructive', icon: <AlertCircle className="h-3 w-3 mr-1" /> },
    };
    const { variant, icon } = config[status];
    return (
      <Badge variant={variant} className="flex items-center w-fit">
        {icon}
        {status}
      </Badge>
    );
  };

  const columns: Column<Invoice>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: (invoice) => (
        <span className="font-mono font-medium">{invoice.invoiceNumber}</span>
      ),
    },
    { key: 'customerName', header: 'Customer' },
    {
      key: 'amount',
      header: 'Amount',
      render: (invoice) => (
        <span className="font-medium">${invoice.amount.toFixed(2)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (invoice) => getStatusBadge(invoice.status),
    },
    { key: 'issueDate', header: 'Issue Date' },
    { key: 'dueDate', header: 'Due Date' },
    {
      key: 'actions',
      header: 'Actions',
      render: (invoice) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Download className="h-4 w-4" />
          </Button>
          {invoice.status === 'draft' && (
            <Button variant="ghost" size="icon">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const totalAmount = mockInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = mockInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.amount, 0);
  const overdueAmount = mockInvoices
    .filter((inv) => inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <DashboardLayout title="Invoices" subtitle="Manage billing and invoices">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockInvoices.length}</p>
              <p className="text-sm text-muted-foreground">Total Invoices</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totalAmount.toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">Total Billed</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">${paidAmount.toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">Collected</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Clock className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">${overdueAmount.toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ocean">
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filteredInvoices} />
    </DashboardLayout>
  );
};

export default InvoicesPage;
