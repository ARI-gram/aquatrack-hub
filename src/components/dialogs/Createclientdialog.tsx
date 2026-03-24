/**
 * Create Client Form Dialog — with Credentials Display
 * src/components/dialogs/Createclientdialog.tsx
 *
 * After creation the API returns { user, temporary_password }.
 * A second dialog opens showing those credentials with one-click copy.
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogTrigger, DialogFooter,
  DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Building2, Plus, CheckCircle2, ChevronRight,
  Sparkles, MapPin, CreditCard, Copy, ShieldAlert, Check,
} from 'lucide-react';
import { CascadingLocationSelector } from '@/components/common/CascadingLocationSelector';
import { clientsService } from '@/api/services/clients.service';
import type { CreateClientRequest } from '@/types/client.types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const createClientSchema = z.object({
  name:             z.string().min(2, 'Company name must be at least 2 characters'),
  email:            z.string().email('Invalid email address'),
  phone:            z.string().min(10, 'Phone number must be at least 10 digits'),
  website:          z.string().url('Invalid URL').optional().or(z.literal('')),
  country:          z.string().min(2, 'Country is required'),
  city:             z.string().min(2, 'City is required'),
  state:            z.string().min(2, 'Area / County is required'),
  address:          z.string().min(5, 'Street address must be at least 5 characters'),
  zipCode:          z.string().min(3, 'Postal code is required'),
  subscriptionPlan: z.enum(['free_trial', 'basic', 'pro', 'enterprise'], {
    required_error: 'Please select a subscription plan',
  }),
});

type CreateClientFormData = z.infer<typeof createClientSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Company',  icon: Building2 },
  { id: 2, label: 'Location', icon: MapPin },
  { id: 3, label: 'Plan',     icon: CreditCard },
] as const;

const SUBSCRIPTION_PLANS = [
  {
    value: 'free_trial' as const,
    label: 'Free Trial',
    period: '10–14 days',
    description: 'Full platform access, no payment required',
    price: 'FREE',
    priceNote: null,
    highlight: false,
    badge: null,
  },
  {
    value: 'basic' as const,
    label: 'Starter',
    period: 'Monthly',
    description: 'Ideal for small distributors just getting started',
    price: 'KSh 15,000',
    priceNote: '/ month',
    highlight: false,
    badge: null,
  },
  {
    value: 'pro' as const,
    label: 'Professional',
    period: '6-Month',
    description: 'Best balance of flexibility and savings',
    price: 'KSh 12,750',
    priceNote: '/ month',
    highlight: true,
    badge: 'Most Popular',
  },
  {
    value: 'enterprise' as const,
    label: 'Enterprise',
    period: 'Annual',
    description: 'Maximum savings for committed distributors',
    price: 'KSh 10,500',
    priceNote: '/ month',
    highlight: false,
    badge: 'Save 30%',
  },
] as const;

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

// ─── Credentials dialog ───────────────────────────────────────────────────────

interface CredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  email: string;
  password: string;
}

const CredentialsDialog: React.FC<CredentialsDialogProps> = ({
  open, onClose, email, password,
}) => {
  const [copiedEmail, setCopiedEmail]       = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const copy = async (text: string, type: 'email' | 'password') => {
    await navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 bg-gradient-to-br from-success/10 via-success/5 to-transparent border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-success flex items-center justify-center shadow-lg shadow-success/25 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Client Created Successfully
              </DialogTitle>
              <DialogDescription className="text-sm mt-0.5">
                Share these credentials with the client securely
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Login Email
            </Label>
            <div className="flex gap-2">
              <Input
                value={email}
                readOnly
                className="h-10 bg-muted/40 font-medium text-foreground cursor-default"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10 shrink-0"
                onClick={() => copy(email, 'email')}
              >
                {copiedEmail
                  ? <Check className="h-4 w-4 text-success" />
                  : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Temporary password */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Temporary Password
            </Label>
            <div className="flex gap-2">
              <Input
                value={password}
                readOnly
                className="h-10 bg-muted/40 font-mono tracking-widest text-foreground cursor-default"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-10 w-10 shrink-0"
                onClick={() => copy(password, 'password')}
              >
                {copiedPassword
                  ? <Check className="h-4 w-4 text-success" />
                  : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/25">
            <ShieldAlert className="h-4.5 w-4.5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-warning mb-0.5">Share securely</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Send these credentials to the client through a secure channel.
                They will be prompted to change their password on first login.
                This password will <strong>not</strong> be shown again.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => copy(`Email: ${email}\nPassword: ${password}`, 'password')}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy Both
          </Button>
          <Button type="button" variant="ocean" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
      <span className="inline-block h-1 w-1 rounded-full bg-destructive" />
      {message}
    </p>
  ) : null;

const SectionHeader: React.FC<{
  step: number; title: string; subtitle: string; icon: React.ElementType;
}> = ({ step, title, subtitle, icon: Icon }) => (
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

// ─── API response type ────────────────────────────────────────────────────────

interface CreateClientResponse {
  user: { email: string; [key: string]: unknown };
  temporary_password: string;
}

interface ApiError {
  response?: { data?: { message?: string; email?: string[] } };
  message?: string;
}

interface CreateClientDialogProps { trigger?: React.ReactNode; }

// ─── Main component ───────────────────────────────────────────────────────────

export const CreateClientDialog: React.FC<CreateClientDialogProps> = ({ trigger }) => {
  const [open, setOpen]           = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const queryClient               = useQueryClient();

  // Credentials dialog state
  const [credsOpen, setCredsOpen]     = useState(false);
  const [credsEmail, setCredsEmail]   = useState('');
  const [credsPassword, setCredsPassword] = useState('');

  const {
    register, handleSubmit, formState: { errors },
    setValue, watch, reset, trigger: triggerValidation,
  } = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: '', email: '', phone: '', website: '',
      country: 'Kenya', city: '', state: '', address: '', zipCode: '',
      subscriptionPlan: 'free_trial',
    },
  });

  const country          = watch('country');
  const subscriptionPlan = watch('subscriptionPlan');

  const locationValue = {
    city:    watch('city'),
    state:   watch('state'),
    address: watch('address'),
    zipCode: watch('zipCode'),
  };

  const handleLocationChange = (next: Partial<typeof locationValue>) => {
    if (next.city    !== undefined) setValue('city',    next.city,    { shouldValidate: true });
    if (next.state   !== undefined) setValue('state',   next.state,   { shouldValidate: true });
    if (next.address !== undefined) setValue('address', next.address, { shouldValidate: true });
    if (next.zipCode !== undefined) setValue('zipCode', next.zipCode, { shouldValidate: true });
  };

  const handleNext = async () => {
    const stepFields: Record<number, (keyof CreateClientFormData)[]> = {
      1: ['name', 'email', 'phone'],
      2: ['country', 'city', 'state', 'address', 'zipCode'],
    };
    const valid = await triggerValidation(stepFields[activeStep]);
    if (valid) setActiveStep((s) => s + 1);
  };

  const createClientMutation = useMutation({
    mutationFn: (data: CreateClientRequest) =>
      clientsService.createClient(data) as Promise<CreateClientResponse>,
    onSuccess: (response) => {
      // Store credentials and show the credentials dialog
      setCredsEmail(response.user.email);
      setCredsPassword(response.temporary_password);

      // Reset and close the main form
      reset();
      setActiveStep(1);
      setOpen(false);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['billing-stats'] });

      // Open credentials dialog
      setCredsOpen(true);
    },
    onError: (error: ApiError) => {
      const emailError = error.response?.data?.email?.[0];
      const message = emailError ?? error.response?.data?.message ?? error.message ?? 'Failed to create client';
      toast.error(message);
    },
  });

  const handleClose = () => {
    reset();
    setActiveStep(1);
    setOpen(false);
  };

  return (
    <>
      {/* ── Main create dialog ──────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else setOpen(true); }}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="ocean">
              <Plus className="h-4 w-4 mr-2" />Add Client
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col">

          {/* Header */}
          <div className="relative px-6 pt-6 pb-5 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent border-b border-border/60 shrink-0">
            <div className="absolute right-6 top-3 opacity-5 pointer-events-none">
              <Building2 className="h-20 w-20 text-primary" />
            </div>

            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
                <Building2 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground tracking-tight">Create New Client</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Add a distributor account — credentials will be sent automatically
                </p>
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mt-5">
              {STEPS.map((step, i) => {
                const isCompleted = activeStep > step.id;
                const isActive    = activeStep === step.id;
                return (
                  <React.Fragment key={step.id}>
                    <button
                      type="button"
                      onClick={() => isCompleted && setActiveStep(step.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                          : isCompleted
                          ? 'bg-success/15 text-success cursor-pointer hover:bg-success/25'
                          : 'bg-muted/60 text-muted-foreground cursor-default'
                      }`}
                    >
                      {isCompleted
                        ? <CheckCircle2 className="h-3.5 w-3.5" />
                        : <span className={`h-4 w-4 rounded-full border text-[10px] flex items-center justify-center font-bold ${isActive ? 'border-primary-foreground/50' : 'border-muted-foreground/40'}`}>{step.id}</span>
                      }
                      {step.label}
                    </button>
                    {i < STEPS.length - 1 && (
                      <ChevronRight className={`h-3 w-3 shrink-0 ${isCompleted ? 'text-success/60' : 'text-muted-foreground/30'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Scrollable body */}
          <form
            onSubmit={handleSubmit((d) => createClientMutation.mutate(d as CreateClientRequest))}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* ── Step 1: Company ─────────────────────────────────────── */}
              {activeStep === 1 && (
                <div className="space-y-5">
                  <SectionHeader step={1} icon={Building2}
                    title="Company Information"
                    subtitle="Basic details about the distributor" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-1.5">
                      <Label htmlFor="c-name" className="text-xs font-medium">
                        Company Name <span className="text-destructive">*</span>
                      </Label>
                      <Input id="c-name" placeholder="e.g., Pure Water Distributors Ltd."
                        {...register('name')} className={`h-10 ${errors.name ? 'border-destructive' : ''}`} />
                      <FieldError message={errors.name?.message} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="c-email" className="text-xs font-medium">
                        Admin Email <span className="text-destructive">*</span>
                      </Label>
                      <Input id="c-email" type="email" placeholder="admin@company.co.ke"
                        {...register('email')} className={`h-10 ${errors.email ? 'border-destructive' : ''}`} />
                      <FieldError message={errors.email?.message} />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="c-phone" className="text-xs font-medium">
                        Phone Number <span className="text-destructive">*</span>
                      </Label>
                      <Input id="c-phone" type="tel" placeholder="+254 700 000 000"
                        {...register('phone')} className={`h-10 ${errors.phone ? 'border-destructive' : ''}`} />
                      <FieldError message={errors.phone?.message} />
                    </div>

                    <div className="md:col-span-2 space-y-1.5">
                      <Label htmlFor="c-website" className="text-xs font-medium">
                        Website <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <Input id="c-website" type="url" placeholder="https://company.co.ke"
                        {...register('website')} className={`h-10 ${errors.website ? 'border-destructive' : ''}`} />
                      <FieldError message={errors.website?.message} />
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3.5 rounded-lg bg-muted/40 border border-border/50">
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      An admin account will be created automatically using this email.
                      A temporary password will be generated — you'll see it immediately after creation
                      so you can share it with the client.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 2: Location ────────────────────────────────────── */}
              {activeStep === 2 && (
                <div className="space-y-5">
                  <SectionHeader step={2} icon={MapPin}
                    title="Address Information"
                    subtitle="Select country, then narrow down to area — postal code auto-fills" />

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Country <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={country}
                      onValueChange={(v) => {
                        setValue('country', v, { shouldValidate: true });
                        handleLocationChange({ city: '', state: '', address: '', zipCode: '' });
                      }}
                    >
                      <SelectTrigger className={`h-10 ${errors.country ? 'border-destructive' : ''}`}>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={errors.country?.message} />
                  </div>

                  {country && (
                    <CascadingLocationSelector
                      country={country}
                      value={locationValue}
                      onChange={handleLocationChange}
                      errors={{ city: errors.city, state: errors.state, address: errors.address, zipCode: errors.zipCode }}
                    />
                  )}
                </div>
              )}

              {/* ── Step 3: Plan ────────────────────────────────────────── */}
              {activeStep === 3 && (
                <div className="space-y-5">
                  <SectionHeader step={3} icon={CreditCard}
                    title="Subscription Plan"
                    subtitle="Choose the billing cycle that suits the client" />

                  <div className="flex items-center gap-3 p-3.5 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <CreditCard className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">One-time onboarding fee: KSh 20,000</p>
                      <p className="text-xs text-muted-foreground">Billed separately before the subscription begins</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SUBSCRIPTION_PLANS.map((plan) => {
                      const isSelected = subscriptionPlan === plan.value;
                      return (
                        <button
                          key={plan.value}
                          type="button"
                          onClick={() => setValue('subscriptionPlan', plan.value)}
                          className={`relative p-4 rounded-xl border-2 text-left transition-all duration-150 group ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                              : 'border-border/70 hover:border-primary/40 hover:bg-muted/30 bg-background'
                          }`}
                        >
                          {plan.badge && (
                            <span className={`absolute -top-2.5 left-3.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              plan.highlight
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-success/15 text-success border border-success/30'
                            }`}>
                              {plan.badge}
                            </span>
                          )}
                          <div className={`absolute top-3 right-3 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? 'border-primary bg-primary' : 'border-border/50 group-hover:border-primary/40'
                          }`}>
                            {isSelected && (
                              <svg className="h-2.5 w-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                                <path d="M3.707 5.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 00-1.414-1.414L5 6.586 3.707 5.293z" />
                              </svg>
                            )}
                          </div>
                          <div className="pr-6">
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="text-sm font-bold text-foreground">{plan.label}</span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                              }`}>{plan.period}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{plan.description}</p>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-lg font-bold tracking-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                {plan.price}
                              </span>
                              {plan.priceNote && (
                                <span className="text-xs text-muted-foreground">{plan.priceNote}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <FieldError message={errors.subscriptionPlan?.message} />

                  {subscriptionPlan && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
                      <span className="text-muted-foreground">Selected plan</span>
                      <span className="font-semibold text-foreground">
                        {SUBSCRIPTION_PLANS.find((p) => p.value === subscriptionPlan)?.label} ·{' '}
                        {SUBSCRIPTION_PLANS.find((p) => p.value === subscriptionPlan)?.price}
                        {SUBSCRIPTION_PLANS.find((p) => p.value === subscriptionPlan)?.priceNote}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fixed footer */}
            <div className="shrink-0 px-6 py-4 border-t border-border/60 bg-muted/20 flex items-center justify-between gap-3">
              <div>
                {activeStep > 1 && (
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => setActiveStep((s) => s - 1)}
                    disabled={createClientMutation.isPending}
                    className="text-muted-foreground">
                    ← Back
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm"
                  onClick={handleClose} disabled={createClientMutation.isPending}>
                  Cancel
                </Button>
                {activeStep < 3 ? (
                  <Button type="button" variant="ocean" size="sm" onClick={handleNext}>
                    Continue <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button type="submit" variant="ocean" size="sm" disabled={createClientMutation.isPending}>
                    {createClientMutation.isPending
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating account...</>
                      : <><CheckCircle2 className="h-4 w-4 mr-2" />Create Client</>}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Credentials display — opens after successful creation ────────── */}
      <CredentialsDialog
        open={credsOpen}
        onClose={() => setCredsOpen(false)}
        email={credsEmail}
        password={credsPassword}
      />
    </>
  );
};