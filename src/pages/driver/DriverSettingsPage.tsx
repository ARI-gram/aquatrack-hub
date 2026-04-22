/**
 * src/pages/driver/DriverSettingsPage.tsx
 */

import React, { useState } from 'react';
import { DriverLayout } from '@/components/layout/DriverLayout';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Bell, Moon, Globe, Volume2, LogOut, MapPin, KeyRound, Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import authService from '@/api/services/auth.service';
import { type ApiErrorResponse } from '@/api/services/settings.service';

// ── LocalStorage settings (UI-only, no backend) ───────────────────────────────

interface UISettings {
  pushNotifications: boolean;
  soundAlerts:       boolean;
  darkMode:          boolean;
  language:          string;
  locationSharing:   boolean;
}

const UI_DEFAULTS: UISettings = {
  pushNotifications: true,
  soundAlerts:       true,
  darkMode:          false,
  language:          'en',
  locationSharing:   true,
};

function loadUISettings(): UISettings {
  try {
    const saved = localStorage.getItem('driver_settings');
    return saved ? { ...UI_DEFAULTS, ...JSON.parse(saved) } : UI_DEFAULTS;
  } catch {
    return UI_DEFAULTS;
  }
}

function persistUISettings(next: UISettings) {
  try {
    localStorage.setItem('driver_settings', JSON.stringify(next));
  } catch {
    console.warn('Could not persist settings');
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
    <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</p>
    </div>
    <div className="divide-y divide-border/40">{children}</div>
  </div>
);

const Row: React.FC<{
  icon:         React.ReactNode;
  iconBg:       string;
  label:        string;
  description?: string;
  children:     React.ReactNode;
}> = ({ icon, iconBg, label, description, children }) => (
  <div className="flex items-center gap-3 px-4 py-4">
    <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium">{label}</p>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

export const DriverSettingsPage: React.FC = () => {
  const { logout } = useAuth();

  const [uiSettings, setUISettings] = useState<UISettings>(loadUISettings);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });
  const [savingPw, setSavingPw] = useState(false);

  const updateUI = <K extends keyof UISettings>(key: K, value: UISettings[K]) => {
    const next = { ...uiSettings, [key]: value };
    setUISettings(next);
    persistUISettings(next);
    toast.success('Setting saved');
  };

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

  return (
    <DriverLayout title="Settings">
      <div className="max-w-lg mx-auto space-y-4 pb-4">

        {/* Notifications */}
        <Section title="Notifications">
          <Row
            icon={<Bell className="h-4 w-4 text-blue-600" />}
            iconBg="bg-blue-50 dark:bg-blue-950/40"
            label="Push notifications"
            description="New deliveries and status updates"
          >
            <Switch
              checked={uiSettings.pushNotifications}
              onCheckedChange={v => updateUI('pushNotifications', v)}
            />
          </Row>
          <Row
            icon={<Volume2 className="h-4 w-4 text-violet-600" />}
            iconBg="bg-violet-50 dark:bg-violet-950/40"
            label="Sound alerts"
            description="Play a sound for new assignments"
          >
            <Switch
              checked={uiSettings.soundAlerts}
              onCheckedChange={v => updateUI('soundAlerts', v)}
            />
          </Row>
        </Section>

        {/* Appearance */}
        <Section title="Appearance & Language">
          <Row
            icon={<Moon className="h-4 w-4 text-indigo-600" />}
            iconBg="bg-indigo-50 dark:bg-indigo-950/40"
            label="Dark mode"
          >
            <Switch
              checked={uiSettings.darkMode}
              onCheckedChange={v => updateUI('darkMode', v)}
            />
          </Row>
          <Row
            icon={<Globe className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            label="Language"
          >
            <Select value={uiSettings.language} onValueChange={v => updateUI('language', v)}>
              <SelectTrigger className="w-28 h-9 rounded-xl text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="sw">Swahili</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </Section>

        {/* Privacy */}
        <Section title="Privacy">
          <Row
            icon={<MapPin className="h-4 w-4 text-rose-600" />}
            iconBg="bg-rose-50 dark:bg-rose-950/40"
            label="Live location sharing"
            description="Share GPS position during active deliveries"
          >
            <Switch
              checked={uiSettings.locationSharing}
              onCheckedChange={v => updateUI('locationSharing', v)}
            />
          </Row>
        </Section>

        {/* Password */}
        <Section title="Change Password">
          <div className="px-4 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="drv-current-pw">Current Password</Label>
              <Input
                id="drv-current-pw"
                type="password"
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drv-new-pw">New Password</Label>
              <Input
                id="drv-new-pw"
                type="password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drv-confirm-pw">Confirm New Password</Label>
              <Input
                id="drv-confirm-pw"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={
                savingPw ||
                !passwordForm.currentPassword ||
                !passwordForm.newPassword ||
                !passwordForm.confirmPassword
              }
              className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPw
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <KeyRound className="h-4 w-4" />}
              {savingPw ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </Section>

        {/* Account */}
        <Section title="Account">
          <div className="p-4">
            <button
              onClick={logout}
              className="w-full h-12 rounded-2xl bg-destructive text-destructive-foreground font-bold text-sm flex items-center justify-center gap-2 hover:bg-destructive/90 transition-colors active:scale-[0.98]"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </Section>

      </div>
    </DriverLayout>
  );
};

export default DriverSettingsPage;