/**
 * AddCustomerDialog
 * src/components/dialogs/AddCustomerDialog.tsx
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button }   from '@/components/ui/button';
import { Input }    from '@/components/ui/input';
import { Switch }   from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label }    from '@/components/ui/label';
import {
  Loader2, Mail, Phone, User, RefreshCw, Package,
  CreditCard, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  customerAdminService,
  type AdminCustomer,
  type CreateCustomerRequest,
} from '@/api/services/customerAdmin.service';

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  full_name:    z.string().min(2, 'Full name is required').max(255),
  phone_number: z
    .string()
    .min(10, 'Enter a valid phone number')
    .regex(/^\+/, 'Must include country code, e.g. +254712345678'),
  email:         z.string().email('Enter a valid email address'),
  customer_type: z.enum(['REFILL', 'ONETIME', 'HYBRID']),

  // Credit fields
  enable_credit:    z.boolean().default(false),
  billing_cycle:    z.enum(['IMMEDIATE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']).optional(),
  credit_limit:     z.coerce.number().min(0).default(0),
  payment_due_days: z.coerce.number().int().min(1).max(365).default(30),
  credit_notes:     z.string().max(500).optional(),
})
  .refine(
    d => !d.enable_credit || d.billing_cycle !== undefined,
    { message: 'Billing cycle is required when credit is enabled', path: ['billing_cycle'] },
  )
  .refine(
    d => !d.enable_credit || d.credit_limit > 0,
    { message: 'Credit limit must be greater than 0', path: ['credit_limit'] },
  );

type FormValues = z.infer<typeof schema>;

// ── Constants ─────────────────────────────────────────────────────────────────

const BILLING_CYCLES = [
  { value: 'IMMEDIATE', label: 'Per Order',   hint: 'Invoice generated for each order individually' },
  { value: 'WEEKLY',    label: 'Weekly',      hint: 'Invoiced every Monday for the prior week' },
  { value: 'BIWEEKLY',  label: 'Bi-Weekly',   hint: 'Invoiced on the 1st and 15th of each month' },
  { value: 'MONTHLY',   label: 'Monthly',     hint: 'Invoiced on the 1st of each month' },
] as const;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface AddCustomerDialogProps {
  open:      boolean;
  onClose:   () => void;
  onCreated: (customer: AdminCustomer, inviteUrl: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AddCustomerDialog: React.FC<AddCustomerDialogProps> = ({
  open, onClose, onCreated,
}) => {
  const [isLoading,   setIsLoading]   = useState(false);
  const [showCredit,  setShowCredit]  = useState(false);
  const { toast }                     = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name:        '',
      phone_number:     '',
      email:            '',
      customer_type:    'REFILL',
      enable_credit:    false,
      billing_cycle:    undefined,
      credit_limit:     0,
      payment_due_days: 30,
      credit_notes:     '',
    },
  });

  const enableCredit = form.watch('enable_credit');

  // Reset credit sub-fields when toggled off
  useEffect(() => {
    if (!enableCredit) {
      form.setValue('billing_cycle',    undefined);
      form.setValue('credit_limit',     0);
      form.setValue('payment_due_days', 30);
      form.setValue('credit_notes',     '');
    }
  }, [enableCredit, form]);

  // Reset entire form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setShowCredit(false);
    }
  }, [open, form]);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      const payload: CreateCustomerRequest = {
        full_name:     data.full_name,
        phone_number:  data.phone_number,
        email:         data.email,
        customer_type: data.customer_type,
      };

      if (data.enable_credit && data.billing_cycle) {
        payload.billing_cycle    = data.billing_cycle;
        payload.credit_limit     = data.credit_limit.toFixed(2);
        payload.payment_due_days = data.payment_due_days;
        payload.credit_notes     = data.credit_notes ?? '';
      }

      const result = await customerAdminService.createCustomer(payload);
      onCreated(result.customer, result.invite_url);
      onClose();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: Record<string, string | string[]> } })
        ?.response?.data;
      const msg =
        (errData?.phone_number as string[] | undefined)?.[0] ??
        (errData?.email        as string[] | undefined)?.[0] ??
        (errData?.credit_limit as string[] | undefined)?.[0] ??
        (errData?.non_field_errors as string[] | undefined)?.[0] ??
        (errData?.detail as string | undefined) ??
        'Failed to create customer. Please try again.';
      toast({ title: 'Error', description: String(msg), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
          <DialogDescription>
            Create a customer account and send them an email invite to complete registration.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

            {/* Full Name */}
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Ahmed Mohammed" className="pl-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone */}
              <FormField control={form.control} name="phone_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="tel" placeholder="+254712345678" className="pl-9" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Customer Type */}
              <FormField control={form.control} name="customer_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="REFILL">
                        <span className="flex items-center gap-2">
                          <RefreshCw className="h-3.5 w-3.5 text-success" />Refill
                        </span>
                      </SelectItem>
                      <SelectItem value="ONETIME">
                        <span className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-accent" />One-time
                        </span>
                      </SelectItem>
                      <SelectItem value="HYBRID">
                        <span className="flex items-center gap-2">
                          <RefreshCw className="h-3.5 w-3.5 text-warning" />Hybrid
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Email */}
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" placeholder="ahmed@email.com" className="pl-9" {...field} />
                  </div>
                </FormControl>
                <p className="text-xs text-muted-foreground mt-1">
                  The invite link will be sent to this address.
                </p>
                <FormMessage />
              </FormItem>
            )} />

            {/* ── Credit / Cheque Account ───────────────────────────────────── */}
            <div className="border rounded-xl overflow-hidden">

              {/* Collapsible header */}
              <button
                type="button"
                onClick={() => setShowCredit(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-sm">Credit / Cheque Account</span>
                  {enableCredit && (
                    <span className="text-[11px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                      Enabled
                    </span>
                  )}
                </div>
                {showCredit
                  ? <ChevronUp   className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                }
              </button>

              {showCredit && (
                <div className="px-4 pb-5 space-y-4 border-t bg-muted/20">

                  {/* Info banner */}
                  <div className="flex gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg mt-4">
                    <Info className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-purple-800 dark:text-purple-300">
                      Credit customers order without upfront payment. You invoice them
                      periodically and they settle by cheque, bank transfer, or cash.
                    </p>
                  </div>

                  {/* Enable toggle */}
                  <FormField control={form.control} name="enable_credit" render={({ field }) => (
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enable-credit" className="text-sm font-medium cursor-pointer">
                        Enable credit account
                      </Label>
                      <Switch
                        id="enable-credit"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </div>
                  )} />

                  {enableCredit && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {/* Billing Cycle */}
                        <FormField control={form.control} name="billing_cycle" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Billing Cycle</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value ?? ''}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select cycle" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {BILLING_CYCLES.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{opt.label}</span>
                                      <span className="text-xs text-muted-foreground">{opt.hint}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )} />

                        {/* Payment Due Days */}
                        <FormField control={form.control} name="payment_due_days" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Due (days)</FormLabel>
                            <FormControl>
                              <Input type="number" min={1} max={365} placeholder="30" {...field} />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Days after invoice before it becomes overdue
                            </p>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>

                      {/* Credit Limit */}
                      <FormField control={form.control} name="credit_limit" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Credit Limit (KES)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                                KES
                              </span>
                              <Input
                                type="number"
                                min={0}
                                step={500}
                                placeholder="5000"
                                className="pl-12"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Maximum unpaid balance this customer can carry
                          </p>
                          <FormMessage />
                        </FormItem>
                      )} />

                      {/* Notes */}
                      <FormField control={form.control} name="credit_notes" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g. Pays by cheque end of month. Contact Finance Dept on +254..."
                              rows={2}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="ocean" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating & Sending Invite…
                  </>
                ) : (
                  'Create & Send Invite'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};