import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField,
  FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Button }      from '@/components/ui/button';
import { Input }       from '@/components/ui/input';
import { Loader2, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { useToast }    from '@/hooks/use-toast';
import { authService } from '@/api/services/auth.service';
import { useAuth }     from '@/contexts/AuthContext';   // ← fixed path

const schema = z.object({
  currentPassword: z.string().min(1, 'Required'),
  newPassword: z.string()
    .min(8,         'At least 8 characters')
    .regex(/[A-Z]/, 'At least one uppercase letter')
    .regex(/[a-z]/, 'At least one lowercase letter')
    .regex(/[0-9]/, 'At least one number'),
  confirmPassword: z.string().min(1, 'Required'),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path:    ['confirmPassword'],
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open:   boolean;
  reason: 'temporary' | 'expired';
}

export const ForceChangePasswordModal: React.FC<Props> = ({ open, reason }) => {
  const { refreshUser } = useAuth();
  const { toast }       = useToast();
  const [isLoading,   setIsLoading]   = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      await authService.changePassword({
        currentPassword: data.currentPassword,
        newPassword:     data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      await refreshUser();
      toast({
        title:       'Password updated',
        description: 'Your password has been changed successfully.',
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { old_password?: string[]; detail?: string } } };
      const msg = e?.response?.data?.old_password?.[0]
        ?? e?.response?.data?.detail
        ?? 'Failed to change password. Please try again.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordInput = ({
    name, show, toggle, placeholder,
  }: {
    name:        keyof FormValues;
    show:        boolean;
    toggle:      () => void;
    placeholder: string;
  }) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>
          {name === 'currentPassword'
            ? (reason === 'temporary' ? 'Temporary Password' : 'Current Password')
            : name === 'newPassword' ? 'New Password' : 'Confirm New Password'}
        </FormLabel>
        <FormControl>
          <div className="relative">
            <Input type={show ? 'text' : 'password'} placeholder={placeholder} {...field} />
            <button
              type="button"
              onClick={toggle}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15">
            <ShieldAlert className="h-6 w-6 text-warning" />
          </div>
          <DialogTitle>
            {reason === 'temporary' ? 'Set Your Password' : 'Password Expired'}
          </DialogTitle>
          <DialogDescription>
            {reason === 'temporary'
              ? 'You were given a temporary password. Please set a permanent one before continuing.'
              : 'Your password is older than 30 days. Please set a new one to keep your account secure.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <PasswordInput
              name="currentPassword"
              show={showCurrent}
              toggle={() => setShowCurrent(v => !v)}
              placeholder="Your current password"
            />
            <PasswordInput
              name="newPassword"
              show={showNew}
              toggle={() => setShowNew(v => !v)}
              placeholder="Min 8 chars, uppercase, number"
            />
            <PasswordInput
              name="confirmPassword"
              show={showConfirm}
              toggle={() => setShowConfirm(v => !v)}
              placeholder="Repeat your new password"
            />

            <p className="text-xs text-muted-foreground">
              Must be at least 8 characters with one uppercase letter and one number.
            </p>

            <Button type="submit" className="w-full" variant="ocean" disabled={isLoading}>
              {isLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating…</>
                : 'Set New Password'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};