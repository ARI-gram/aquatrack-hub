/**
 * Employees Page
 * Role: Client Admin
 * Route: /client/employees
 * Employee management (Site Managers, Drivers)
 */

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable, Column } from '@/components/common/DataTable';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Plus,
  MoreHorizontal,
  Users,
  UserCheck,
  Truck,
  Building2,
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'site_manager' | 'driver';
  status: 'active' | 'inactive';
  hiredDate: string;
  performance?: number;
}

const mockEmployees: Employee[] = [
  {
    id: '1',
    name: 'Sarah Manager',
    email: 'sarah@purewater.com',
    phone: '+1 555-0201',
    role: 'site_manager',
    status: 'active',
    hiredDate: '2023-06-15',
    performance: 94,
  },
  {
    id: '2',
    name: 'Mike Driver',
    email: 'mike@purewater.com',
    phone: '+1 555-0202',
    role: 'driver',
    status: 'active',
    hiredDate: '2023-08-20',
    performance: 88,
  },
  {
    id: '3',
    name: 'John Smith',
    email: 'john@purewater.com',
    phone: '+1 555-0203',
    role: 'driver',
    status: 'active',
    hiredDate: '2024-01-10',
    performance: 92,
  },
  {
    id: '4',
    name: 'Emily Brown',
    email: 'emily@purewater.com',
    phone: '+1 555-0204',
    role: 'site_manager',
    status: 'inactive',
    hiredDate: '2022-11-05',
    performance: 78,
  },
];

const EmployeesPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEmployees = mockEmployees.filter(
    (employee) =>
      employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role: Employee['role']) => {
    if (role === 'site_manager') {
      return (
        <Badge variant="info" className="flex items-center gap-1 w-fit">
          <Building2 className="h-3 w-3" />
          Site Manager
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="flex items-center gap-1 w-fit">
        <Truck className="h-3 w-3" />
        Driver
      </Badge>
    );
  };

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (employee) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src="" />
            <AvatarFallback>
              {employee.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{employee.name}</p>
            <p className="text-sm text-muted-foreground">{employee.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone' },
    {
      key: 'role',
      header: 'Role',
      render: (employee) => getRoleBadge(employee.role),
    },
    {
      key: 'status',
      header: 'Status',
      render: (employee) => (
        <Badge variant={employee.status === 'active' ? 'success' : 'secondary'}>
          {employee.status}
        </Badge>
      ),
    },
    {
      key: 'performance',
      header: 'Performance',
      render: (employee) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-ocean rounded-full"
              style={{ width: `${employee.performance}%` }}
            />
          </div>
          <span className="text-sm">{employee.performance}%</span>
        </div>
      ),
    },
    { key: 'hiredDate', header: 'Hired Date' },
    {
      key: 'actions',
      header: '',
      render: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Profile</DropdownMenuItem>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>View Performance</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const siteManagers = mockEmployees.filter((e) => e.role === 'site_manager');
  const drivers = mockEmployees.filter((e) => e.role === 'driver');
  const activeEmployees = mockEmployees.filter((e) => e.status === 'active');

  return (
    <DashboardLayout title="Employees" subtitle="Manage your team">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockEmployees.length}</p>
              <p className="text-sm text-muted-foreground">Total Employees</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <UserCheck className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeEmployees.length}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <Building2 className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">{siteManagers.length}</p>
              <p className="text-sm text-muted-foreground">Site Managers</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Truck className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold">{drivers.length}</p>
              <p className="text-sm text-muted-foreground">Drivers</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="ocean">
          <Plus className="h-4 w-4 mr-2" />
          Add Employee
        </Button>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={filteredEmployees} />
    </DashboardLayout>
  );
};

export default EmployeesPage;
