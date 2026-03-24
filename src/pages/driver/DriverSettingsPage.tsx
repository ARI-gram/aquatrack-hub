/**
 * src/pages/driver/DriverSettingsPage.tsx
 * Mobile-first settings page with clean row layout
 */

import React, { useState } from 'react';
import { DriverLayout } from '@/components/layout/DriverLayout';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Bell, Moon, Globe, Volume2, LogOut, MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Settings {
  pushNotifications: boolean;
  soundAlerts:       boolean;
  darkMode:          boolean;
  language:          string;
  locationSharing:   boolean;
}

const DEFAULTS: Settings = {
  pushNotifications: true,
  soundAlerts:       true,
  darkMode:          false,
  language:          'en',
  locationSharing:   true,
};

function loadSettings(): Settings {
  try {
    const saved = localStorage.getItem('driver_settings');
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(next: Settings) {
  try {
    localStorage.setItem('driver_settings', JSON.stringify(next));
  } catch {
    console.warn('Could not persist settings');
  }
}

// ── Setting section wrapper ───────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
    <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</p>
    </div>
    <div className="divide-y divide-border/40">{children}</div>
  </div>
);

// ── Setting row ───────────────────────────────────────────────────────────────

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
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
    toast.success('Setting saved');
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
              checked={settings.pushNotifications}
              onCheckedChange={v => update('pushNotifications', v)}
            />
          </Row>
          <Row
            icon={<Volume2 className="h-4 w-4 text-violet-600" />}
            iconBg="bg-violet-50 dark:bg-violet-950/40"
            label="Sound alerts"
            description="Play a sound for new assignments"
          >
            <Switch
              checked={settings.soundAlerts}
              onCheckedChange={v => update('soundAlerts', v)}
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
              checked={settings.darkMode}
              onCheckedChange={v => update('darkMode', v)}
            />
          </Row>
          <Row
            icon={<Globe className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            label="Language"
          >
            <Select value={settings.language} onValueChange={v => update('language', v)}>
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
              checked={settings.locationSharing}
              onCheckedChange={v => update('locationSharing', v)}
            />
          </Row>
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