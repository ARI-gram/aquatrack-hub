/**
 * src/pages/driver/DriverProfilePage.tsx
 * Mobile-first profile page
 */

import React, { useState, useEffect } from 'react';
import { DriverLayout } from '@/components/layout/DriverLayout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  User, Phone, Mail, Truck, Package,
  CheckCircle, TrendingUp, Loader2,
} from 'lucide-react';
import { deliveryService, DriverDelivery } from '@/api/services/delivery.service';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface DriverProfile {
  driver: {
    name: string;
    phone: string;
    email?: string;
    vehicle_number: string;
  };
}

export const DriverProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile]       = useState<DriverProfile | null>(null);
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [profileData, deliveriesData] = await Promise.all([
        deliveryService.getDriverProfile(),
        deliveryService.getDriverDeliveries(),
      ]);
      setProfile(profileData);
      setDeliveries(deliveriesData.deliveries || []);
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <DriverLayout title="My Profile">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DriverLayout>
    );
  }

  const name     = profile?.driver?.name || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Driver';
  const phone    = profile?.driver?.phone || '—';
  const email    = profile?.driver?.email || user?.email || '—';
  const vehicle  = profile?.driver?.vehicle_number || '—';
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  const total     = deliveries.length;
  const completed = deliveries.filter(d => d.status === 'COMPLETED').length;
  const failed    = deliveries.filter(d => d.status === 'FAILED').length;
  const pending   = deliveries.filter(d => !['COMPLETED', 'FAILED'].includes(d.status)).length;
  const rate      = total ? Math.round((completed / total) * 100) : 0;

  return (
    <DriverLayout title="My Profile">
      <div className="max-w-lg mx-auto space-y-4 pb-4">

        {/* Identity card */}
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-4 mb-5">
            <Avatar className="h-16 w-16 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="text-xl font-bold truncate">{name}</h2>
              <Badge variant="secondary" className="mt-1.5">Driver</Badge>
            </div>
          </div>

          <div className="space-y-0 divide-y divide-border/50">
            {[
              { Icon: Phone, label: 'Phone',   value: phone   },
              { Icon: Mail,  label: 'Email',   value: email   },
              { Icon: Truck, label: 'Vehicle', value: vehicle },
            ].map(({ Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-3.5">
                <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className="font-medium text-sm mt-0.5 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's stats */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/20 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Today's Stats</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Total',     value: total,     color: 'text-foreground',   bg: 'bg-muted/40',      Icon: Package     },
                { label: 'Completed', value: completed, color: 'text-emerald-600',  bg: 'bg-emerald-50 dark:bg-emerald-950/30', Icon: CheckCircle },
                { label: 'Pending',   value: pending,   color: 'text-blue-600',     bg: 'bg-blue-50 dark:bg-blue-950/30',       Icon: Truck       },
                { label: 'Failed',    value: failed,    color: 'text-destructive',  bg: 'bg-red-50 dark:bg-red-950/30',         Icon: Package     },
              ].map(({ label, value, color, bg, Icon }) => (
                <div key={label} className={cn('flex items-center gap-3 p-3.5 rounded-2xl', bg)}>
                  <Icon className={cn('h-5 w-5 shrink-0', color)} />
                  <div>
                    <p className={cn('text-2xl font-black leading-none', color)}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 text-center">
              <p className="text-4xl font-black text-primary">{rate}%</p>
              <p className="text-sm text-muted-foreground mt-1">Completion rate today</p>
              <div className="mt-3 h-2 bg-muted/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground pb-2">
          To update your phone number or vehicle, contact your admin.
        </p>
      </div>
    </DriverLayout>
  );
};

export default DriverProfilePage;