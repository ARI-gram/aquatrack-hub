/**
 * Client Settings Page
 * Role: Client Admin
 * Route: /client/settings
 *
 * Changes: Replaced all mock data with real API calls.
 *  - Company Profile + Business Settings → clientsService.getClientById / updateClient
 *  - Logo → clientsService.uploadLogo
 *  - Notifications → settingsService.getClientNotificationSettings / update
 *  - Security (password) → authService.changePassword
 *  - Billing tab remains read-only display (no billing mutation endpoints exposed to client)
 */

import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2, Bell, CreditCard, Shield, Upload, Save, Loader2, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { clientsService, type Client } from '@/api/services/clients.service';
import {
  settingsService,
  type ClientNotificationSettings,
  type ClientBusinessSettings,
  type ApiErrorResponse,
} from '@/api/services/settings.service';
import authService from '@/api/services/auth.service';

// ── Extended client type ──────────────────────────────────────────────────────

type ClientWithBusinessSettings = Client & ClientBusinessSettings;

// ── Helpers ───────────────────────────────────────────────────────────────────

const FieldSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-10 w-full" />
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const ClientSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const clientId = user?.clientId ?? '';

  // ── Loading states ──────────────────────────────────────────────────────
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [loadingNotifs,  setLoadingNotifs]  = useState(true);
  const [savingCompany,  setSavingCompany]  = useState(false);
  const [savingNotifs,   setSavingNotifs]   = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingLogo,  setUploadingLogo]  = useState(false);

  // ── Company fields ──────────────────────────────────────────────────────
  const [client, setClient] = useState<Client | null>(null);
  const [companyForm, setCompanyForm] = useState({
    name:    '',
    email:   '',
    phone:   '',
    website: '',
    address: '',
    city:    '',
    state:   '',
    zipCode: '',
    country: '',
  });
  const [businessForm, setBusinessForm] = useState({
    timezone:      '',
    currency:      '',
    taxRate:       '',
    invoicePrefix: '',
  });

  // ── Notification fields ─────────────────────────────────────────────────
  const [notifs, setNotifs] = useState<ClientNotificationSettings>({
    newOrderAlerts:    true,
    deliveryUpdates:   true,
    paymentReceived:   true,
    lowStockAlerts:    true,
    weeklyReports:     false,
    orderConfirmation: true,
    deliverySms:       true,
    invoiceEmails:     true,
  });

  // ── Password fields ─────────────────────────────────────────────────────
    const [passwordForm, setPasswordForm] = useState({
      currentPassword: '',
      newPassword:     '',
      confirmPassword: '',
    });

    // ── Password visibility ─────────────────────────────────────────────────  ← ADD HERE
    const [showPasswords, setShowPasswords] = useState({
      current: false,
      new:     false,
      confirm: false,
    });

    const toggleShow = (field: keyof typeof showPasswords) =>
      setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));

  // ── Logo ref ────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load company data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return;
    setLoadingCompany(true);
    clientsService.getClientById(clientId)
      .then(data => {
        setClient(data);
        setCompanyForm({
          name:    data.name    ?? '',
          email:   data.email   ?? '',
          phone:   data.phone   ?? '',
          website: data.website ?? '',
          address: data.address ?? '',
          city:    data.city    ?? '',
          state:   data.state   ?? '',
          zipCode: data.zipCode ?? '',
          country: data.country ?? '',
        });
        const extended = data as ClientWithBusinessSettings;
        setBusinessForm({
          timezone:      extended.timezone      ?? '',
          currency:      extended.currency      ?? '',
          taxRate:       extended.taxRate       ?? '',
          invoicePrefix: extended.invoicePrefix ?? '',
        });
      })
      .catch(() => toast.error('Failed to load company settings'))
      .finally(() => setLoadingCompany(false));
  }, [clientId]);

  // ── Load notification settings ──────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return;
    setLoadingNotifs(true);
    settingsService.getClientNotificationSettings(clientId)
      .then(data => setNotifs(data))
      .catch(() => {
        // Non-fatal — keep defaults if endpoint not yet implemented
      })
      .finally(() => setLoadingNotifs(false));
  }, [clientId]);

  // ── Save company + business ─────────────────────────────────────────────
  const handleSaveCompany = async () => {
    if (!clientId) return;
    setSavingCompany(true);
    try {
      await clientsService.updateClient(clientId, {
        ...companyForm,
        ...businessForm,
      });
      toast.success('Company settings saved');
    } catch {
      toast.error('Failed to save company settings');
    } finally {
      setSavingCompany(false);
    }
  };

  // ── Save notifications ──────────────────────────────────────────────────
  const handleSaveNotifs = async () => {
    if (!clientId) return;
    setSavingNotifs(true);
    try {
      await settingsService.updateClientNotificationSettings(clientId, notifs);
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save notification preferences');
    } finally {
      setSavingNotifs(false);
    }
  };

  // ── Toggle notification helper ──────────────────────────────────────────
  const toggleNotif = (key: keyof ClientNotificationSettings, value: boolean) => {
    setNotifs(prev => ({ ...prev, [key]: value }));
  };

  // ── Logo upload ─────────────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientId) return;
    setUploadingLogo(true);
    try {
      const { logoUrl } = await clientsService.uploadLogo(clientId, file);
      setClient(prev => prev ? { ...prev, logo: logoUrl } : prev);
      toast.success('Logo updated');
    } catch {
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Password change ─────────────────────────────────────────────────────
  const handleSavePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSavingPassword(true);
    try {
      await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword:     passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const error = err as ApiErrorResponse;
      const detail = error?.response?.data?.detail
        ?? error?.response?.data?.old_password?.[0]
        ?? 'Failed to change password';
      toast.error(detail);
    } finally {
      setSavingPassword(false);
    }
  };

  // ── Company initials for avatar fallback ────────────────────────────────
  const initials = companyForm.name
    ? companyForm.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'CO';

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="Settings" subtitle="Manage your company settings">
      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="company">
            <Building2 className="h-4 w-4 mr-2" />
            Company
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="billing">
            <CreditCard className="h-4 w-4 mr-2" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* ── Company Tab ── */}
        <TabsContent value="company" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Company Profile</h3>

            {/* Logo */}
            <div className="flex items-center gap-6 mb-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={client?.logo ?? ''} />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingLogo
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Upload className="h-4 w-4 mr-2" />}
                  {uploadingLogo ? 'Uploading…' : 'Upload Logo'}
                </Button>
                <p className="text-sm text-muted-foreground mt-1">
                  PNG, JPG or WebP · max 2 MB
                </p>
              </div>
            </div>

            {loadingCompany ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 6 }).map((_, i) => <FieldSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(
                  [
                    { id: 'name',    label: 'Company Name' },
                    { id: 'email',   label: 'Email',          type: 'email' },
                    { id: 'phone',   label: 'Phone' },
                    { id: 'website', label: 'Website' },
                    { id: 'city',    label: 'City' },
                    { id: 'state',   label: 'State / County' },
                    { id: 'zipCode', label: 'ZIP / Postcode' },
                    { id: 'country', label: 'Country' },
                  ] as { id: keyof typeof companyForm; label: string; type?: string }[]
                ).map(field => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <Input
                      id={field.id}
                      type={field.type ?? 'text'}
                      value={companyForm[field.id]}
                      onChange={e => setCompanyForm(prev => ({
                        ...prev, [field.id]: e.target.value,
                      }))}
                    />
                  </div>
                ))}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Textarea
                    id="address"
                    rows={2}
                    value={companyForm.address}
                    onChange={e => setCompanyForm(prev => ({
                      ...prev, address: e.target.value,
                    }))}
                  />
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Business Settings</h3>
            {loadingCompany ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => <FieldSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(
                  [
                    { id: 'timezone',      label: 'Timezone',       placeholder: 'Africa/Nairobi' },
                    { id: 'currency',      label: 'Currency',       placeholder: 'KES' },
                    { id: 'taxRate',       label: 'Tax Rate (%)',   placeholder: '16' },
                    { id: 'invoicePrefix', label: 'Invoice Prefix', placeholder: 'INV-' },
                  ] as { id: keyof typeof businessForm; label: string; placeholder: string }[]
                ).map(field => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>{field.label}</Label>
                    <Input
                      id={field.id}
                      placeholder={field.placeholder}
                      value={businessForm[field.id]}
                      onChange={e => setBusinessForm(prev => ({
                        ...prev, [field.id]: e.target.value,
                      }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex justify-end">
            <Button
              variant="ocean"
              onClick={handleSaveCompany}
              disabled={savingCompany || loadingCompany}
            >
              {savingCompany
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Save className="h-4 w-4 mr-2" />}
              {savingCompany ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </TabsContent>

        {/* ── Notifications Tab ── */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Email Notifications</h3>
            {loadingNotifs ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {(
                  [
                    { key: 'newOrderAlerts',  label: 'New Order Alerts',  desc: 'Receive email when a new order is placed' },
                    { key: 'deliveryUpdates', label: 'Delivery Updates',  desc: 'Get notified about delivery status changes' },
                    { key: 'paymentReceived', label: 'Payment Received',  desc: 'Notification when payment is received' },
                    { key: 'lowStockAlerts',  label: 'Low Stock Alerts',  desc: 'Alert when inventory is running low' },
                    { key: 'weeklyReports',   label: 'Weekly Reports',    desc: 'Receive weekly performance summary' },
                  ] as { key: keyof ClientNotificationSettings; label: string; desc: string }[]
                ).map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={notifs[item.key]}
                      onCheckedChange={v => toggleNotif(item.key, v)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Customer Notifications</h3>
            {loadingNotifs ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {(
                  [
                    { key: 'orderConfirmation', label: 'Order Confirmation', desc: 'Send confirmation email to customers' },
                    { key: 'deliverySms',       label: 'Delivery SMS',       desc: 'Send SMS when delivery is on the way' },
                    { key: 'invoiceEmails',     label: 'Invoice Emails',     desc: 'Automatically email invoices' },
                  ] as { key: keyof ClientNotificationSettings; label: string; desc: string }[]
                ).map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={notifs[item.key]}
                      onCheckedChange={v => toggleNotif(item.key, v)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="flex justify-end">
            <Button
              variant="ocean"
              onClick={handleSaveNotifs}
              disabled={savingNotifs || loadingNotifs}
            >
              {savingNotifs
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <Save className="h-4 w-4 mr-2" />}
              {savingNotifs ? 'Saving…' : 'Save Preferences'}
            </Button>
          </div>
        </TabsContent>

        {/* ── Billing Tab — read-only ── */}
        <TabsContent value="billing" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Current Plan</h3>
            {loadingCompany ? (
              <Skeleton className="h-20 w-full rounded-lg" />
            ) : (
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div>
                  <p className="font-semibold text-lg capitalize">
                    {client?.subscriptionPlan ?? 'Unknown'} Plan
                  </p>
                  <p className="text-muted-foreground capitalize">
                    Status: {client?.subscriptionStatus ?? '—'}
                  </p>
                </div>
                <Button variant="outline" disabled>
                  Contact Support to Upgrade
                </Button>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-2">Payment Method</h3>
            <p className="text-sm text-muted-foreground">
              Payment method management is handled by your account administrator.
              Please contact support to update billing details.
            </p>
          </Card>
        </TabsContent>

        {/* ── Security Tab ── */}
        <TabsContent value="security" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Change Password</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm(prev => ({
                      ...prev, currentPassword: e.target.value,
                    }))}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('current')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPasswords.current
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye    className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div /> {/* spacer */}

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm(prev => ({
                      ...prev, newPassword: e.target.value,
                    }))}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('new')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPasswords.new
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye    className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm(prev => ({
                      ...prev, confirmPassword: e.target.value,
                    }))}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShow('confirm')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPasswords.confirm
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye    className="h-4 w-4" />}
                  </button>
                </div>
              </div>

            </div>
            <div className="flex justify-end mt-6">
              <Button
                variant="ocean"
                onClick={handleSavePassword}
                disabled={
                  savingPassword ||
                  !passwordForm.currentPassword ||
                  !passwordForm.newPassword ||
                  !passwordForm.confirmPassword
                }
              >
                {savingPassword
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Save    className="h-4 w-4 mr-2" />}
                {savingPassword ? 'Changing…' : 'Change Password'}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Two-Factor Authentication</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable 2FA</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Switch disabled />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              2FA configuration coming soon. Contact support to enable this for your account.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default ClientSettingsPage;