/**
 * Customer Notifications Settings Page
 * Manage notification preferences
 */

import React, { useState } from 'react';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Bell,
  MessageSquare,
  Mail,
  Smartphone,
  Package,
  Truck,
  Wallet,
  Tag,
  Clock,
  Check,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  sms: boolean;
  email: boolean;
  push: boolean;
}

const NotificationsPage: React.FC = () => {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'order_updates',
      title: 'Order Updates',
      description: 'Get notified when your order status changes',
      icon: Package,
      sms: true,
      email: true,
      push: true,
    },
    {
      id: 'delivery_alerts',
      title: 'Delivery Alerts',
      description: 'Know when your driver is nearby',
      icon: Truck,
      sms: true,
      email: false,
      push: true,
    },
    {
      id: 'wallet_activity',
      title: 'Wallet Activity',
      description: 'Payments, top-ups, and low balance alerts',
      icon: Wallet,
      sms: true,
      email: true,
      push: true,
    },
    {
      id: 'promotions',
      title: 'Promotions & Offers',
      description: 'Special deals and discounts',
      icon: Tag,
      sms: false,
      email: true,
      push: true,
    },
    {
      id: 'reminders',
      title: 'Order Reminders',
      description: 'Reminders to reorder when running low',
      icon: Clock,
      sms: false,
      email: true,
      push: true,
    },
  ]);

  const updateSetting = (id: string, channel: 'sms' | 'email' | 'push', value: boolean) => {
    setSettings(settings.map(s => 
      s.id === id ? { ...s, [channel]: value } : s
    ));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast({
      title: 'Settings saved',
      description: 'Your notification preferences have been updated',
    });
  };

  const enableAll = () => {
    setSettings(settings.map(s => ({ ...s, sms: true, email: true, push: true })));
  };

  const disableAll = () => {
    setSettings(settings.map(s => ({ ...s, sms: false, email: false, push: false })));
  };

  return (
    <CustomerLayout title="Notifications">
      <div className="space-y-6 max-w-lg mx-auto">
        {/* Header */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Notification Preferences</h3>
              <p className="text-sm text-muted-foreground">
                Choose how you want to be notified
              </p>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={enableAll}>
            Enable All
          </Button>
          <Button variant="outline" size="sm" onClick={disableAll}>
            Disable All
          </Button>
        </div>

        {/* Channel Headers */}
        <div className="grid grid-cols-4 gap-2 px-4">
          <div className="col-span-1" />
          <div className="flex flex-col items-center gap-1">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">SMS</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Email</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Push</span>
          </div>
        </div>

        {/* Settings List */}
        <div className="space-y-3">
          {settings.map((setting) => (
            <Card key={setting.id} className="p-4">
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="col-span-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <setting.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{setting.title}</p>
                      <p className="text-xs text-muted-foreground hidden sm:block">
                        {setting.description}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={setting.sms}
                    onCheckedChange={(v) => updateSetting(setting.id, 'sms', v)}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={setting.email}
                    onCheckedChange={(v) => updateSetting(setting.id, 'email', v)}
                  />
                </div>
                <div className="flex justify-center">
                  <Switch
                    checked={setting.push}
                    onCheckedChange={(v) => updateSetting(setting.id, 'push', v)}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Save Button */}
        <Button 
          className="w-full" 
          variant="ocean" 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            'Saving...'
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Save Preferences
            </>
          )}
        </Button>

        {/* Info */}
        <p className="text-xs text-center text-muted-foreground px-4">
          SMS notifications may incur carrier charges. You can unsubscribe from 
          promotional messages at any time.
        </p>
      </div>
    </CustomerLayout>
  );
};

export default NotificationsPage;
