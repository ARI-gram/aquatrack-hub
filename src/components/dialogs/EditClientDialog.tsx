/**
 * Edit Client Dialog — Redesigned
 * src/components/dialogs/EditClientDialog.tsx
 *
 * Same design language as CreateClientDialog — gradient header, numbered
 * section headers, fixed footer. Single-page (no steps) since edit users
 * need to quickly jump to any field.
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Save, Building2, MapPin, CreditCard,
  AlertTriangle, Pencil,
} from 'lucide-react';
import { CascadingLocationSelector } from '@/components/common/CascadingLocationSelector';
import { clientsService } from '@/api/services/clients.service';
import type { Client } from '@/api/services/clients.service';

// ─── Schema ───────────────────────────────────────────────────────────────────

const editClientSchema = z.object({
  name:               z.string().min(2, 'Company name must be at least 2 characters'),
  email:              z.string().email('Invalid email address'),
  phone:              z.string().min(10, 'Phone number must be at least 10 digits'),
  website:            z.string().url('Invalid URL').optional().or(z.literal('')),
  country:            z.string().min(2, 'Country is required'),
  city:               z.string().min(2, 'City is required'),
  state:              z.string().min(2, 'Area / County is required'),
  address:            z.string().min(5, 'Street address must be at least 5 characters'),
  zipCode:            z.string().min(3, 'Postal code is required'),
  subscriptionPlan:   z.enum(['free_trial', 'basic', 'pro', 'enterprise']).optional(),
  subscription_status: z.enum(['active', 'inactive', 'trial', 'cancelled']).optional(),
});

type EditClientFormData = z.infer<typeof editClientSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNTRIES = [
  { value: 'Kenya',         label: '🇰🇪 Kenya' },
  { value: 'Uganda',        label: '🇺🇬 Uganda' },
  { value: 'Tanzania',      label: '🇹🇿 Tanzania' },
  { value: 'Rwanda',        label: '🇷🇼 Rwanda' },
  { value: 'Ethiopia',      label: '🇪🇹 Ethiopia' },
  { value: 'Burundi',       label: '🇧🇮 Burundi' },
  { value: 'Somalia',       label: '🇸🇴 Somalia' },
  { value: 'Nigeria',       label: '🇳🇬 Nigeria' },
  { value: 'South Africa',  label: '🇿🇦 South Africa' },
  { value: 'Ghana',         label: '🇬🇭 Ghana' },
  { value: 'Egypt',         label: '🇪🇬 Egypt' },
  { value: 'Morocco',       label: '🇲🇦 Morocco' },
  { value: 'United States', label: '🇺🇸 United States' },
  { value: 'United Kingdom',label: '🇬🇧 United Kingdom' },
  { value: 'India',         label: '🇮🇳 India' },
  { value: 'Other',         label: 'Other' },
];

const PLAN_OPTIONS = [
  { value: 'free_trial', label: 'Free Trial',                    note: null },
  { value: 'basic',      label: 'Starter',   note: 'KSh 15,000 / mo' },
  { value: 'pro',        label: 'Professional', note: 'KSh 12,750 / mo' },
  { value: 'enterprise', label: 'Enterprise', note: 'KSh 10,500 / mo' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' }> = {
  active:    { label: 'Active',    variant: 'success' },
  trial:     { label: 'Trial',     variant: 'warning' },
  inactive:  { label: 'Inactive',  variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
      <span className="inline-block h-1 w-1 rounded-full bg-destructive shrink-0" />
      {message}
    </p>
  ) : null;

const SectionHeader: React.FC<{
  step: number; icon: React.ElementType; title: string; subtitle: string;
}> = ({ step, icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-4 pb-4 border-b border-border/60">
    <div className="relative shrink-0">
      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Icon className="h-4.5 w-4.5 text-primary" />
      </div>
      <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
        {step}
      </span>
    </div>
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  </div>
);

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditClientDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ApiError {
  response?: { data?: { message?: string; email?: string[] } };
  message?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EditClientDialog: React.FC<EditClientDialogProps> = ({
  client, open, onOpenChange,
}) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    reset,
  } = useForm<EditClientFormData>({ resolver: zodResolver(editClientSchema) });

  // Pre-fill whenever selected client changes
  useEffect(() => {
    if (client) {
      reset({
        name:                client.name,
        email:               client.email,
        phone:               client.phone,
        website:             client.website ?? '',
        country:             client.country,
        city:                client.city,
        state:               client.state,
        address:             client.address,
        zipCode:             client.zipCode,
        subscriptionPlan:    client.subscriptionPlan as EditClientFormData['subscriptionPlan'],
        subscription_status: client.subscriptionStatus as EditClientFormData['subscription_status'],
      });
    }
  }, [client, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: EditClientFormData) => clientsService.updateClient(client!.id, data),
    onSuccess: () => {
      toast.success('Client updated successfully');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-stats', client?.id] });
      onOpenChange(false);
    },
    onError: (error: ApiError) => {
      const emailError = error.response?.data?.email?.[0];
      const message = emailError ?? error.response?.data?.message ?? error.message ?? 'Failed to update client';
      toast.error(message);
    },
  });

  if (!client) return null;

  const country            = watch('country');
  const subscriptionPlan   = watch('subscriptionPlan');
  const subscriptionStatus = watch('subscription_status');

  const locationValue = {
    city:    watch('city'),
    state:   watch('state'),
    address: watch('address'),
    zipCode: watch('zipCode'),
  };

  const handleLocationChange = (next: Partial<typeof locationValue>) => {
    if (next.city    !== undefined) setValue('city',    next.city,    { shouldDirty: true, shouldValidate: true });
    if (next.state   !== undefined) setValue('state',   next.state,   { shouldDirty: true, shouldValidate: true });
    if (next.address !== undefined) setValue('address', next.address, { shouldDirty: true, shouldValidate: true });
    if (next.zipCode !== undefined) setValue('zipCode', next.zipCode, { shouldDirty: true, shouldValidate: true });
  };

  const currentStatus = STATUS_CONFIG[client.subscriptionStatus] ?? STATUS_CONFIG.inactive;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent border-b border-border/60 shrink-0">
          {/* Watermark */}
          <div className="absolute right-6 top-3 opacity-5 pointer-events-none">
            <Pencil className="h-20 w-20 text-primary" />
          </div>

          <div className="flex items-start gap-4">
            {/* Client avatar */}
            <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25 shrink-0 text-primary-foreground text-lg font-bold">
              {client.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-foreground tracking-tight truncate">
                  {client.name}
                </h2>
                <Badge variant={currentStatus.variant} className="shrink-0 text-[10px]">
                  {currentStatus.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{client.email}</p>
            </div>
          </div>

          {/* Unsaved changes warning — only shown when form is dirty */}
          {isDirty && (
            <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg bg-warning/10 border border-warning/25">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
              <p className="text-xs text-warning font-medium">You have unsaved changes</p>
            </div>
          )}
        </div>

        {/* ── Scrollable form body ──────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit((d) => updateMutation.mutate(d))}
          className="flex flex-col flex-1 min-h-0"
        >
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

            {/* ── Section 1: Company ──────────────────────────────────────── */}
            <section className="space-y-5">
              <SectionHeader
                step={1}
                icon={Building2}
                title="Company Information"
                subtitle="Core contact details for this distributor"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <Label htmlFor="e-name" className="text-xs font-medium">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="e-name"
                    {...register('name')}
                    className={`h-10 ${errors.name ? 'border-destructive focus-visible:ring-destructive/20' : ''}`}
                  />
                  <FieldError message={errors.name?.message} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="e-email" className="text-xs font-medium">
                    Admin Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="e-email"
                    type="email"
                    {...register('email')}
                    className={`h-10 ${errors.email ? 'border-destructive' : ''}`}
                  />
                  <FieldError message={errors.email?.message} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="e-phone" className="text-xs font-medium">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="e-phone"
                    type="tel"
                    {...register('phone')}
                    className={`h-10 ${errors.phone ? 'border-destructive' : ''}`}
                  />
                  <FieldError message={errors.phone?.message} />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <Label htmlFor="e-website" className="text-xs font-medium">
                    Website <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="e-website"
                    type="url"
                    placeholder="https://company.co.ke"
                    {...register('website')}
                    className={`h-10 ${errors.website ? 'border-destructive' : ''}`}
                  />
                  <FieldError message={errors.website?.message} />
                </div>
              </div>
            </section>

            {/* ── Section 2: Address ──────────────────────────────────────── */}
            <section className="space-y-5">
              <SectionHeader
                step={2}
                icon={MapPin}
                title="Address"
                subtitle="Changing country resets city and area — postal code auto-fills"
              />

              {/* Country */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Country <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={country}
                  onValueChange={(v) => {
                    if (v !== client.country) {
                      handleLocationChange({ city: '', state: '', address: '', zipCode: '' });
                    }
                    setValue('country', v, { shouldDirty: true, shouldValidate: true });
                  }}
                >
                  <SelectTrigger className={`h-10 ${errors.country ? 'border-destructive' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.country?.message} />
              </div>

              {/* Cascading location */}
              {country && (
                <CascadingLocationSelector
                  country={country}
                  value={locationValue}
                  onChange={handleLocationChange}
                  errors={{
                    city:    errors.city,
                    state:   errors.state,
                    address: errors.address,
                    zipCode: errors.zipCode,
                  }}
                />
              )}
            </section>

            {/* ── Section 3: Subscription ─────────────────────────────────── */}
            <section className="space-y-5">
              <SectionHeader
                step={3}
                icon={CreditCard}
                title="Subscription"
                subtitle="Adjust plan or account status"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Plan */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Billing Plan</Label>
                  <Select
                    value={subscriptionPlan}
                    onValueChange={(v) =>
                      setValue('subscriptionPlan', v as EditClientFormData['subscriptionPlan'], { shouldDirty: true })
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAN_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          <div className="flex items-center justify-between gap-3 w-full">
                            <span>{p.label}</span>
                            {p.note && <span className="text-xs text-muted-foreground">{p.note}</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Account Status</Label>
                  <Select
                    value={subscriptionStatus}
                    onValueChange={(v) =>
                      setValue('subscription_status', v as EditClientFormData['subscription_status'], { shouldDirty: true })
                    }
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                        <SelectItem key={val} value={val}>
                          <div className="flex items-center gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full ${
                              val === 'active'   ? 'bg-success' :
                              val === 'trial'    ? 'bg-warning' :
                              val === 'inactive' ? 'bg-destructive' :
                              'bg-muted-foreground'
                            }`} />
                            {cfg.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Status change warning */}
              {subscriptionStatus === 'inactive' && client.subscriptionStatus !== 'inactive' && (
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-destructive/8 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-destructive">Setting to Inactive</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This will block the client's access to the platform immediately.
                      They can be reactivated at any time.
                    </p>
                  </div>
                </div>
              )}
              {subscriptionStatus === 'cancelled' && client.subscriptionStatus !== 'cancelled' && (
                <div className="flex items-start gap-3 p-3.5 rounded-lg bg-destructive/8 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-destructive">Setting to Cancelled</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This permanently ends the subscription. All outstanding invoices
                      must still be settled.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* ── Fixed footer ─────────────────────────────────────────────────── */}
          <div className="shrink-0 px-6 py-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
            {/* Dirty indicator */}
            <p className={`text-xs transition-opacity ${isDirty ? 'text-muted-foreground opacity-100' : 'opacity-0'}`}>
              Unsaved changes
            </p>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="ocean"
                size="sm"
                disabled={updateMutation.isPending || !isDirty}
              >
                {updateMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving changes...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" />Save Changes</>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};