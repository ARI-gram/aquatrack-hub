/**
 * EditEmployeeDialog
 * src/components/dialogs/EditEmployeeDialog.tsx
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Badge }   from '@/components/ui/badge';
import { Loader2, Car, Building2, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { employeeService } from '@/api/services/employee.service';
import { Employee } from '@/types/employee.types';

const schema = z.object({
  firstName:   z.string().min(1, 'First name is required').max(100),
  lastName:    z.string().min(1, 'Last name is required').max(100),
  phone:       z.string().max(15).optional(),
  numberPlate: z.string().max(20).optional(),
});

type FormValues = z.infer<typeof schema>;

export interface EditEmployeeDialogProps {
  open:      boolean;
  employee:  Employee | null;
  onClose:   () => void;
  onUpdated: (employee: Employee) => void;
}

export const EditEmployeeDialog: React.FC<EditEmployeeDialogProps> = ({
  open,
  employee,
  onClose,
  onUpdated,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const isDriver = employee?.role === 'driver';

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', phone: '', numberPlate: '' },
  });

  useEffect(() => {
    if (employee) {
      form.reset({
        firstName:   employee.firstName,
        lastName:    employee.lastName,
        phone:       employee.phone ?? '',
        numberPlate: employee.numberPlate ?? '',
      });
    }
  }, [employee, form]);

  const onSubmit = async (data: FormValues) => {
    if (!employee) return;
    setIsLoading(true);
    try {
      const updated = await employeeService.updateEmployee(employee.id, {
        firstName: data.firstName,
        lastName:  data.lastName,
        phone:     data.phone || undefined,
        ...(isDriver && {
          numberPlate: data.numberPlate?.trim().toUpperCase() || '',
        }),
      });
      onUpdated(updated);
      onClose();
      toast({ title: 'Employee updated', description: `${updated.fullName}'s details have been saved.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to update employee.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
          <DialogDescription>
            Update details for <span className="font-medium text-foreground">{employee?.fullName}</span>.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

            {/* Role indicator — read only */}
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
              {isDriver
                ? <Truck     className="h-4 w-4 text-green-500" />
                : <Building2 className="h-4 w-4 text-blue-500" />}
              <span className="text-sm font-medium">{isDriver ? 'Driver' : 'Site Manager'}</span>
              <span className="ml-auto text-xs text-muted-foreground">Role cannot be changed</span>
            </div>

            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="+254 700 000000" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Number plate — drivers only */}
            {isDriver && (
              <FormField
                control={form.control}
                name="numberPlate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      Vehicle Number Plate
                      {!employee?.numberPlate && (
                        <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                          Not assigned
                        </Badge>
                      )}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="KCA 123A"
                        className="font-mono tracking-wider uppercase"
                        {...field}
                        onChange={e => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {employee?.numberPlate
                        ? 'Update the vehicle assigned to this driver.'
                        : 'Assign a vehicle number plate to this driver.'}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" variant="ocean" disabled={isLoading}>
                {isLoading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                  : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};