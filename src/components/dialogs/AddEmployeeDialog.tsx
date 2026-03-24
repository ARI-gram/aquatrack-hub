/**
 * AddEmployeeDialog
 * src/components/dialogs/AddEmployeeDialog.tsx
 *
 * Roles: site_manager, driver, accountant
 * - driver requires a number plate
 * - accountant gets access to accounts module only
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Truck, Building2, Car, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { employeeService } from '@/api/services/employee.service';
import { Employee } from '@/types/employee.types';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z
  .object({
    firstName:    z.string().min(1, 'First name is required').max(100),
    lastName:     z.string().min(1, 'Last name is required').max(100),
    email:        z.string().email('Please enter a valid email'),
    phone:        z.string().max(15).optional(),
    role:         z.enum(['site_manager', 'driver', 'accountant'], {
      required_error: 'Please select a role',
    }),
    number_plate: z.string().max(20).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'driver' && !data.number_plate?.trim()) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        message: 'Number plate is required for drivers',
        path:    ['number_plate'],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

// ─── Role metadata ────────────────────────────────────────────────────────────

const ROLE_META = {
  site_manager: {
    label:       'Site Manager',
    icon:        Building2,
    iconColor:   'text-blue-500',
    description: 'Manages orders, products and site operations',
  },
  driver: {
    label:       'Driver',
    icon:        Truck,
    iconColor:   'text-green-500',
    description: 'Handles deliveries and roadside sales',
  },
  accountant: {
    label:       'Accountant',
    icon:        Calculator,
    iconColor:   'text-violet-500',
    description: 'Manages invoices, reports and accounting settings',
  },
} as const;

type RoleKey = keyof typeof ROLE_META;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface AddEmployeeDialogProps {
  open:      boolean;
  onClose:   () => void;
  onCreated: (employee: Employee, password: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const AddEmployeeDialog: React.FC<AddEmployeeDialogProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName:    '',
      lastName:     '',
      email:        '',
      phone:        '',
      role:         undefined,
      number_plate: '',
    },
  });

  const selectedRole = form.watch('role') as RoleKey | undefined;
  const isDriver     = selectedRole === 'driver';

  // Reset form whenever dialog closes
  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

  // Clear number_plate when switching away from driver
  useEffect(() => {
    if (!isDriver) form.setValue('number_plate', '');
  }, [isDriver, form]);

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      const result = await employeeService.createEmployee({
        firstName:    data.firstName,
        lastName:     data.lastName,
        email:        data.email,
        phone:        data.phone || undefined,
        role:         data.role,
        number_plate: data.role === 'driver'
          ? data.number_plate?.trim().toUpperCase()
          : undefined,
      });
      onCreated(result.employee, result.temporary_password);
      onClose();
    } catch (err: unknown) {
      const errData = (err as {
        response?: { data?: Record<string, unknown> };
      })?.response?.data;

      const msg =
        (errData?.number_plate     as string[])?.[0] ??
        (errData?.email            as string[])?.[0] ??
        (errData?.non_field_errors as string[])?.[0] ??
        (errData?.detail           as string) ??
        'Failed to create employee. Please try again.';

      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription>
            Create a new team member. Login credentials will be emailed to them automatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jane@company.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone + Role row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="+254 700 000000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.entries(ROLE_META) as [RoleKey, typeof ROLE_META[RoleKey]][]).map(
                          ([key, meta]) => {
                            const Icon = meta.icon;
                            return (
                              <SelectItem key={key} value={key}>
                                <span className="flex items-center gap-2">
                                  <Icon className={`h-3.5 w-3.5 ${meta.iconColor}`} />
                                  {meta.label}
                                </span>
                              </SelectItem>
                            );
                          }
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Role description chip */}
            {selectedRole && (
              <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                {(() => {
                  const meta = ROLE_META[selectedRole];
                  const Icon = meta.icon;
                  return <Icon className={`h-4 w-4 shrink-0 ${meta.iconColor}`} />;
                })()}
                <p className="text-xs text-muted-foreground">
                  {ROLE_META[selectedRole].description}
                </p>
              </div>
            )}

            {/* Number Plate — only shown when role = driver */}
            {isDriver && (
              <FormField
                control={form.control}
                name="number_plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      Vehicle Number Plate
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Required
                      </Badge>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="KCA 123A"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                        className="font-mono tracking-wider uppercase"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      This vehicle will be assigned to the driver and used for deliveries.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="ocean" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
                ) : (
                  'Create Employee'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};