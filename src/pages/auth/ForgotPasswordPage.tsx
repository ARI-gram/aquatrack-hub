// src/pages/auth/ForgotPasswordPage.tsx
/**
 * Forgot Password Page
 * Route: /forgot-password
 * Allows users to request a password reset email
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { ArrowLeft, Mail, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast }    from '@/hooks/use-toast';
import { ROUTES }      from '@/constants/routes';
import authService     from '@/api/services/auth.service';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const ForgotPasswordPage: React.FC = () => {
  const [isLoading,   setIsLoading]   = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await authService.forgotPassword({ email: data.email });
      // Always show success — backend never reveals if the email exists
      setIsSubmitted(true);
    } catch (error: unknown) {
      let msg = 'Something went wrong. Please try again.';
      if (isAxiosError(error)) {
        const d = error.response?.data;
        msg =
          (typeof d?.detail === 'string'             ? d.detail              : null) ??
          (Array.isArray(d?.email)                   ? d.email[0]            : null) ??
          (Array.isArray(d?.non_field_errors)        ? d.non_field_errors[0] : null) ??
          error.message ??
          msg;
      }
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-surface p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-full bg-success/10">
              <CheckCircle className="h-12 w-12 text-success" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
          <p className="text-muted-foreground mb-6">
            If an account exists for{' '}
            <span className="font-medium text-foreground">
              {form.getValues('email')}
            </span>
            , you'll receive reset instructions shortly. Check your spam folder
            if it doesn't arrive within a few minutes.
          </p>
          <div className="space-y-3">
            <Link to={ROUTES.LOGIN}>
              <Button variant="ocean" className="w-full">
                Return to Login
              </Button>
            </Link>
            <Button
              variant="ghost"
              className="w-full text-sm text-muted-foreground"
              onClick={() => {
                setIsSubmitted(false);
                form.reset();
              }}
            >
              Try a different email
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ── Form screen ───────────────────────────────────────────────────────────

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
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Forgot your password?</h1>
          <p className="text-muted-foreground mt-2">
            No worries! Enter your email and we'll send you reset instructions.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              variant="ocean"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
              ) : (
                'Send Reset Instructions'
              )}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;