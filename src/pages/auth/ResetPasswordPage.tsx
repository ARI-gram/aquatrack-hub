// src/pages/auth/ResetPasswordPage.tsx
import React, { useState }         from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm }                 from 'react-hook-form';
import { zodResolver }             from '@hookform/resolvers/zod';
import { z }                       from 'zod';
import { isAxiosError }            from 'axios';
import { ArrowLeft, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button }                  from '@/components/ui/button';
import { Input }                   from '@/components/ui/input';
import { Card }                    from '@/components/ui/card';
import {
  Form, FormControl, FormField,
  FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { useToast }   from '@/hooks/use-toast';
import { ROUTES }     from '@/constants/routes';
import authService    from '@/api/services/auth.service';

const schema = z.object({
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

const ResetPasswordPage: React.FC = () => {
  const [searchParams]              = useSearchParams();
  const navigate                    = useNavigate();
  const { toast }                   = useToast();
  const [isLoading,    setIsLoading]    = useState(false);
  const [showNew,      setShowNew]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  const token = searchParams.get('token') ?? '';

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  // Guard: no token in URL
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4">
        <Card className="w-full max-w-md p-8 text-center space-y-4">
          <Lock className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">Invalid Reset Link</h1>
          <p className="text-muted-foreground text-sm">
            This password reset link is missing or malformed.
            Please request a new one.
          </p>
          <Link to={ROUTES.FORGOT_PASSWORD}>
            <Button variant="ocean" className="w-full">Request New Link</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    try {
      await authService.resetPassword({
        token,
        newPassword:     data.newPassword,
        confirmPassword: data.confirmPassword,
      });
      toast({
        title:       'Password reset',
        description: 'Your password has been updated. Please log in.',
      });
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (error: unknown) {
      let msg = 'Reset failed. The link may have expired.';
      if (isAxiosError(error)) {
        const d = error.response?.data;
        msg =
          (typeof d?.detail        === 'string' ? d.detail             : null) ??
          (Array.isArray(d?.token)              ? d.token[0]           : null) ??
          (Array.isArray(d?.new_password)       ? d.new_password[0]    : null) ??
          error.message ??
          msg;
      }
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4">
      <Card className="w-full max-w-md p-8">
        <Link
          to={ROUTES.LOGIN}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to login
        </Link>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Lock className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
          <p className="text-muted-foreground mt-2">
            Must be at least 8 characters with one uppercase letter and one number.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* New password */}
            <FormField control={form.control} name="newPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showNew ? 'text' : 'password'}
                      placeholder="Min 8 chars, uppercase, number"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Confirm password */}
            <FormField control={form.control} name="confirmPassword" render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your new password"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <Button
              type="submit"
              variant="ocean"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting…</>
                : 'Reset Password'}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;