/**
 * Customer Profile Page
 * View and edit customer profile information
 */

import React, { useEffect, useState } from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { useAuth } from '@/contexts/AuthContext';
import { customerAdminService, type AdminCustomer } from '@/api/services/customerAdmin.service';
import { bottleService } from '@/api/services/bottle.service';
import { type BottleInventory } from '@/types/bottle.types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  User,
  Mail,
  Phone,
  Edit2,
  Save,
  X,
  Camera,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });

  const [customer, setCustomer] = useState<AdminCustomer | null>(null);
  const [inventory, setInventory] = useState<BottleInventory | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchStats = async () => {
      try {
        setStatsLoading(true);
        const [cust, inv] = await Promise.all([
          customerAdminService.getCustomer(user.id),
          bottleService.getInventory(),
        ]);
        setCustomer(cust);
        setInventory(inv);
      } catch (err) {
        console.error('Failed to load profile stats:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [user?.id]);

  // Keep form in sync with auth user in case it updates externally
  useEffect(() => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
    });
  }, [user]);

  const handleSave = () => {
    // TODO: wire to a PATCH /customers/{id}/ call when the customer-facing
    // profile update endpoint is available. For now, optimistically update UI.
    toast({
      title: 'Profile Updated',
      description: 'Your changes have been saved successfully',
    });
    setIsEditing(false);
  };

  const memberSince = customer?.created_at
    ? format(new Date(customer.created_at), 'MMMM yyyy')
    : null;

  const walletBalance = customer?.wallet_balance
    ? parseFloat(customer.wallet_balance).toLocaleString('en-KE', {
        minimumFractionDigits: 2,
      })
    : null;

  const depositOnFile = inventory
    ? (inventory.totalOwned * inventory.depositPerBottle).toLocaleString('en-KE', {
        minimumFractionDigits: 2,
      })
    : null;

  const customerTypeLabel =
    customer?.customer_type_display ?? customer?.customer_type ?? 'Customer';

  return (
    <CustomerLayout title="My Profile">
      <div className="space-y-6 max-w-lg mx-auto">
        {/* Profile Header */}
        <Card className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarFallback className="bg-gradient-ocean text-primary-foreground text-2xl">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
            <h2 className="mt-4 text-xl font-semibold">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-muted-foreground">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="gap-1">
                <RefreshCw className="h-3 w-3" />
                {customerTypeLabel}
              </Badge>
              {customer?.is_phone_verified && (
                <Badge variant="outline" className="gap-1 text-success border-success/30">
                  <Shield className="h-3 w-3" />
                  Verified
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Profile Form */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold">Personal Information</h3>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFormData({
                      firstName: user?.firstName || '',
                      lastName: user?.lastName || '',
                      email: user?.email || '',
                    });
                    setIsEditing(false);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="pl-10"
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10"
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={customer?.phone_number ?? '—'}
                  className="pl-10"
                  disabled
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Contact support to change your phone number
              </p>
            </div>
          </div>
        </Card>

        {/* Account Stats */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Account Summary</h3>
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">
                  {customer?.total_orders ?? '—'}
                </p>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-success">
                  {inventory?.totalOwned ?? '—'}
                </p>
                <p className="text-sm text-muted-foreground">Bottles Owned</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">
                  {walletBalance != null ? `KES ${walletBalance}` : '—'}
                </p>
                <p className="text-sm text-muted-foreground">Wallet Balance</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">
                  {depositOnFile != null ? `KES ${depositOnFile}` : '—'}
                </p>
                <p className="text-sm text-muted-foreground">Deposit on File</p>
              </div>
            </div>
          )}
        </Card>

        {/* Member Since */}
        {memberSince && (
          <Card className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Member since</span>
              <span className="font-medium">{memberSince}</span>
            </div>
          </Card>
        )}
      </div>
    </CustomerLayout>
  );
};

export default ProfilePage;