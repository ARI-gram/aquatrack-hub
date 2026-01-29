/**
 * Audit Logs Page
 * Role: Super Admin
 * Route: /admin/audit-logs
 * System audit trail and activity logs
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
  Download,
  Filter,
  Activity,
  Shield,
  AlertTriangle,
  User,
} from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  userRole: string;
  action: string;
  resource: string;
  details: string;
  ipAddress: string;
  severity: 'info' | 'warning' | 'critical';
}

const mockLogs: AuditLog[] = [
  {
    id: '1',
    timestamp: '2024-11-15 14:32:15',
    user: 'admin@aquatrack.com',
    userRole: 'Super Admin',
    action: 'LOGIN',
    resource: 'Authentication',
    details: 'Successful login from new device',
    ipAddress: '192.168.1.100',
    severity: 'info',
  },
  {
    id: '2',
    timestamp: '2024-11-15 14:28:42',
    user: 'client@purewater.com',
    userRole: 'Client Admin',
    action: 'UPDATE',
    resource: 'User Settings',
    details: 'Changed password',
    ipAddress: '10.0.0.45',
    severity: 'info',
  },
  {
    id: '3',
    timestamp: '2024-11-15 14:15:08',
    user: 'admin@aquatrack.com',
    userRole: 'Super Admin',
    action: 'DELETE',
    resource: 'Client Account',
    details: 'Deleted client: Aqua Solutions',
    ipAddress: '192.168.1.100',
    severity: 'warning',
  },
  {
    id: '4',
    timestamp: '2024-11-15 13:55:21',
    user: 'unknown',
    userRole: 'N/A',
    action: 'LOGIN_FAILED',
    resource: 'Authentication',
    details: 'Multiple failed login attempts (5)',
    ipAddress: '203.0.113.42',
    severity: 'critical',
  },
  {
    id: '5',
    timestamp: '2024-11-15 13:42:33',
    user: 'admin@aquatrack.com',
    userRole: 'Super Admin',
    action: 'CREATE',
    resource: 'Billing Plan',
    details: 'Created new plan: Premium Plus',
    ipAddress: '192.168.1.100',
    severity: 'info',
  },
];

const AuditLogsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const filteredLogs = mockLogs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity =
      severityFilter === 'all' || log.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const getSeverityBadge = (severity: AuditLog['severity']) => {
    const config: Record<
      AuditLog['severity'],
      { variant: 'success' | 'warning' | 'destructive'; icon: React.ReactNode }
    > = {
      info: { variant: 'success', icon: <Activity className="h-3 w-3 mr-1" /> },
      warning: {
        variant: 'warning',
        icon: <AlertTriangle className="h-3 w-3 mr-1" />,
      },
      critical: {
        variant: 'destructive',
        icon: <Shield className="h-3 w-3 mr-1" />,
      },
    };
    const { variant, icon } = config[severity];
    return (
      <Badge variant={variant} className="flex items-center w-fit">
        {icon}
        {severity}
      </Badge>
    );
  };

  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (log) => (
        <span className="text-sm font-mono">{log.timestamp}</span>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (log) => (
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">{log.user}</p>
            <p className="text-xs text-muted-foreground">{log.userRole}</p>
          </div>
        </div>
      ),
    },
    { key: 'action', header: 'Action' },
    { key: 'resource', header: 'Resource' },
    {
      key: 'severity',
      header: 'Severity',
      render: (log) => getSeverityBadge(log.severity),
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (log) => (
        <span className="font-mono text-sm">{log.ipAddress}</span>
      ),
    },
  ];

  return (
    <DashboardLayout title="Audit Logs" subtitle="System activity and security logs">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{mockLogs.length}</p>
              <p className="text-sm text-muted-foreground">Total Events</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Activity className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockLogs.filter((l) => l.severity === 'info').length}
              </p>
              <p className="text-sm text-muted-foreground">Info Events</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockLogs.filter((l) => l.severity === 'warning').length}
              </p>
              <p className="text-sm text-muted-foreground">Warnings</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {mockLogs.filter((l) => l.severity === 'critical').length}
              </p>
              <p className="text-sm text-muted-foreground">Critical</p>
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
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        onRowClick={(log) => console.log('View log:', log)}
      />
    </DashboardLayout>
  );
};

export default AuditLogsPage;
