/**
 * System Settings Page
 * Role: Super Admin
 * Route: /super-admin/settings
 *
 * Changes: Replaced all mock data with real API calls.
 *  - General + Feature Flags + Security + Notifications + Email → settingsService
 *  - Password change → authService.changePassword
 *  - Integrations tab remains display-only (no configure endpoints exist yet)
 */

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Settings, Bell, Shield, Mail, Globe, Database, Save, RefreshCw, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  settingsService,
  type SystemSettings,
  type ApiErrorResponse,
} from '@/api/services/settings.service';
import authService from '@/api/services/auth.service';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS: SystemSettings = {
  platformName:       'AquaTrack',
  supportEmail:       '',
  timezone:           'utc',
  currency:           'usd',
  enableDarkMode:     true,
  enableAnalytics:    true,
  maintenanceMode:    false,
  sessionTimeout:     60,
  maxLoginAttempts:   5,
  require2FA:         false,
  ipWhitelisting:     false,
  emailNotifications: true,
  smsNotifications:   false,
  pushNotifications:  true,
  smtpHost:    '',
  smtpPort:    '',
  smtpUser:    '',
  smtpPass:    '',
  emailFooter: '',
};

// ── Helper ────────────────────────────────────────────────────────────────────

const FieldSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-10 w-full" />
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const SystemSettingsPage: React.FC = () => {
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savingPw,  setSavingPw]  = useState(false);

  const [settings, setSettings] = useState<SystemSettings>(DEFAULTS);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    settingsService.getSystemSettings()
      .then(data => setSettings(data))
      .catch(() => {
        toast.info('Using default settings — backend settings endpoint not available');
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const set = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await settingsService.updateSystemSettings(settings);
      setSettings(updated);
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ───────────────────────────────────────────────────────────────
  const handleReset = async () => {
    setResetting(true);
    try {
      const updated = await settingsService.updateSystemSettings(DEFAULTS);
      setSettings(updated);
      toast.success('Settings reset to defaults');
    } catch {
      setSettings(DEFAULTS);
      toast.success('Settings reset to defaults (local only)');
    } finally {
      setResetting(false);
    }
  };

  // ── Password ────────────────────────────────────────────────────────────
  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSavingPw(true);
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
      setSavingPw(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="System Settings" subtitle="Configure platform settings">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />General
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />Security
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-2" />Email
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Globe className="h-4 w-4 mr-2" />Integrations
          </TabsTrigger>
        </TabsList>

        {/* ── General ── */}
        <TabsContent value="general" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Platform Settings</h3>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => <FieldSkeleton key={i} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Platform Name</Label>
                  <Input
                    value={settings.platformName}
                    onChange={e => set('platformName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input
                    type="email"
                    value={settings.supportEmail}
                    onChange={e => set('supportEmail', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Timezone</Label>
                  <Select value={settings.timezone} onValueChange={v => set('timezone', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utc">UTC</SelectItem>
                      <SelectItem value="africa_nairobi">Africa/Nairobi (EAT)</SelectItem>
                      <SelectItem value="est">Eastern Time (EST)</SelectItem>
                      <SelectItem value="pst">Pacific Time (PST)</SelectItem>
                      <SelectItem value="cet">Central European Time (CET)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Select value={settings.currency} onValueChange={v => set('currency', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kes">KES (KSh)</SelectItem>
                      <SelectItem value="usd">USD ($)</SelectItem>
                      <SelectItem value="eur">EUR (€)</SelectItem>
                      <SelectItem value="gbp">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Feature Flags</h3>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {(
                  [
                    { key: 'enableDarkMode',  label: 'Enable Dark Mode',  desc: 'Allow users to switch to dark theme' },
                    { key: 'enableAnalytics', label: 'Enable Analytics',  desc: 'Track platform usage and performance' },
                    { key: 'maintenanceMode', label: 'Maintenance Mode',  desc: 'Temporarily disable platform access' },
                  ] as { key: keyof SystemSettings; label: string; desc: string }[]
                ).map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={settings[item.key] as boolean}
                      onCheckedChange={v => set(item.key, v)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Notifications ── */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Notification Channels</h3>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {(
                  [
                    { key: 'emailNotifications', label: 'Email Notifications', desc: 'Send system alerts via email' },
                    { key: 'smsNotifications',   label: 'SMS Notifications',   desc: 'Send critical alerts via SMS' },
                    { key: 'pushNotifications',  label: 'Push Notifications',  desc: 'Enable browser push notifications' },
                  ] as { key: keyof SystemSettings; label: string; desc: string }[]
                ).map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={settings[item.key] as boolean}
                      onCheckedChange={v => set(item.key, v)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Security ── */}
        <TabsContent value="security" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Platform Security</h3>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FieldSkeleton /><FieldSkeleton />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
                    <Label>Session Timeout (minutes)</Label>
                    <Input
                      type="number"
                      value={settings.sessionTimeout}
                      onChange={e => set('sessionTimeout', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Login Attempts</Label>
                    <Input
                      type="number"
                      value={settings.maxLoginAttempts}
                      onChange={e => set('maxLoginAttempts', Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  {(
                    [
                      { key: 'require2FA',     label: 'Require 2FA',     desc: 'Require 2FA for all admin accounts' },
                      { key: 'ipWhitelisting', label: 'IP Whitelisting', desc: 'Restrict access to specific IP addresses' },
                    ] as { key: keyof SystemSettings; label: string; desc: string }[]
                  ).map(item => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch
                        checked={settings[item.key] as boolean}
                        onCheckedChange={v => set(item.key, v)}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Change Password</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                />
              </div>
              <div />
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button
                variant="ocean"
                onClick={handleChangePassword}
                disabled={
                  savingPw ||
                  !passwordForm.currentPassword ||
                  !passwordForm.newPassword ||
                  !passwordForm.confirmPassword
                }
              >
                {savingPw
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Save className="h-4 w-4 mr-2" />}
                {savingPw ? 'Changing…' : 'Change Password'}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* ── Email ── */}
        <TabsContent value="email" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Email / SMTP Configuration</h3>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => <FieldSkeleton key={i} />)}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>SMTP Host</Label>
                    <Input
                      placeholder="smtp.example.com"
                      value={settings.smtpHost}
                      onChange={e => set('smtpHost', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Port</Label>
                    <Input
                      placeholder="587"
                      value={settings.smtpPort}
                      onChange={e => set('smtpPort', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Username</Label>
                    <Input
                      value={settings.smtpUser}
                      onChange={e => set('smtpUser', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={settings.smtpPass}
                      onChange={e => set('smtpPass', e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label>Email Footer</Label>
                  <Textarea
                    rows={3}
                    placeholder="Default email footer text…"
                    value={settings.emailFooter}
                    onChange={e => set('emailFooter', e.target.value)}
                  />
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        {/* ── Integrations — display only ── */}
        <TabsContent value="integrations" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Third-Party Integrations</h3>
            <div className="space-y-4">
              {[
                { icon: <Database className="h-8 w-8 text-primary" />, name: 'Google Maps API', desc: 'Route optimisation and tracking' },
                { icon: <Mail     className="h-8 w-8 text-primary" />, name: 'Twilio',          desc: 'SMS notifications' },
                { icon: <Globe    className="h-8 w-8 text-primary" />, name: 'Stripe',           desc: 'Payment processing' },
              ].map(item => (
                <div key={item.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled>
                    Coming Soon
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4 mt-6">
        <Button variant="outline" onClick={handleReset} disabled={resetting || loading}>
          {resetting
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <RefreshCw className="h-4 w-4 mr-2" />}
          {resetting ? 'Resetting…' : 'Reset to Defaults'}
        </Button>
        <Button variant="ocean" onClick={handleSave} disabled={saving || loading}>
          {saving
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <Save className="h-4 w-4 mr-2" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </DashboardLayout>
  );
};

export default SystemSettingsPage;