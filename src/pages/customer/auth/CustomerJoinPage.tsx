// src/pages/customer/auth/CustomerJoinPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import { Droplets, Phone, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

type Step = 'loading' | 'confirm' | 'otp' | 'done' | 'error';

interface InviteInfo {
  customer_id:  string;
  full_name:    string;
  phone_number: string;
  email:        string;
  company_name: string;
  invite_token: string;
}

const CustomerJoinPage: React.FC = () => {
  const { token }  = useParams<{ token: string }>();
  const navigate   = useNavigate();
  const { toast }  = useToast();
  const { loginAsCustomer, user } = useAuth();

  const [step,       setStep]       = useState<Step>('loading');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [otp,        setOtp]        = useState('');
  const [isLoading,  setIsLoading]  = useState(false);
  const [errorMsg,   setErrorMsg]   = useState('');

  // ── Navigate AFTER user state is committed ────────────────────────────────
  // Same race condition as CustomerLoginPage — don't call navigate() directly
  // after loginAsCustomer(). Watch user state instead.
  useEffect(() => {
    if (user && user.role === 'customer') {
      navigate(CUSTOMER_ROUTES.DASHBOARD, { replace: true });
    }
  }, [user, navigate]);

  // ── Resolve invite token on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setErrorMsg('Invalid invite link.');
      setStep('error');
      return;
    }
    publicApi.get(`/customers/invite/${token}/`)
      .then(({ data }) => {
        setInviteInfo(data);
        setStep('confirm');
      })
      .catch(err => {
        const msg =
          err?.response?.data?.error ??
          err?.response?.data?.detail ??
          'This invite link is invalid or has expired.';
        setErrorMsg(msg);
        setStep('error');
      });
  }, [token]);

  const handleSendOtp = async () => {
    if (!inviteInfo) return;
    setIsLoading(true);
    try {
      await publicApi.post('/customer/auth/send-otp/', {
        phone: inviteInfo.phone_number,
        email: inviteInfo.email,
      });
      setStep('otp');
      toast({
        title: 'Code sent!',
        description: `A 6-digit code was sent to ${inviteInfo.email}.`,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { non_field_errors?: string[] } } })
          ?.response?.data?.non_field_errors?.[0] ??
        (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ??
        'Could not send verification code. Please try again.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6 || !inviteInfo) return;
    setIsLoading(true);

    try {
      const { data } = await publicApi.post(
        `/customers/invite/${token}/complete/`,
        {
          phone_number: inviteInfo.phone_number,
          otp_code:     otp,
        }
      );

      // Clear any stale staff session
      localStorage.removeItem('aquatrack_token');
      localStorage.removeItem('aquatrack_refresh_token');
      localStorage.removeItem('aquatrack_user');
      localStorage.removeItem('customer_data');

      const nameParts    = (data.customer.full_name ?? '').trim().split(/\s+/);
      const customerUser = {
        id:        data.customer.id,
        email:     data.customer.email ?? '',
        firstName: nameParts[0] ?? '',
        lastName:  nameParts.slice(1).join(' '),
        role:      'customer' as const,
        phone:     data.customer.phone_number,
        fullName:  data.customer.full_name,
        clientId:  data.customer.client ?? null,
        createdAt: data.customer.created_at ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem('customer_data', JSON.stringify(data.customer));

      // loginAsCustomer sets React state + localStorage.
      // useEffect above handles navigation once user state is committed.
      loginAsCustomer(customerUser, data.tokens.access, data.tokens.refresh);

      setStep('done');
      toast({ title: '🎉 Account activated!', description: 'Welcome to AquaTrack.' });
      // ← NO setTimeout + navigate() here — useEffect handles it
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })
          ?.response?.data?.error ??
        (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ??
        'Invalid or expired code. Please try again.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!inviteInfo) return;
    setIsLoading(true);
    try {
      await publicApi.post('/customer/auth/send-otp/', {
        phone: inviteInfo.phone_number,
        email: inviteInfo.email,
      });
      toast({ title: 'Code resent', description: `A new code was sent to ${inviteInfo.email}.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to resend code.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex flex-col">
      <header className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-ocean shadow-glow">
            <Droplets className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">AquaTrack</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 sm:p-8">

          {/* Loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying your invite link…</p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="text-center py-6 space-y-4">
              <div className="text-4xl">❌</div>
              <h2 className="text-xl font-bold">Invite Invalid</h2>
              <p className="text-muted-foreground text-sm">{errorMsg}</p>
              <p className="text-xs text-muted-foreground">
                Contact your distributor to request a new invite link.
              </p>
              <Link to={CUSTOMER_ROUTES.LOGIN}>
                <Button variant="outline" className="mt-2">Go to Login</Button>
              </Link>
            </div>
          )}

          {/* Confirm identity */}
          {step === 'confirm' && inviteInfo && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">Complete Your Account</h1>
                <p className="text-muted-foreground text-sm">
                  {inviteInfo.company_name} has invited you to join AquaTrack.
                </p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Name</p>
                  <p className="font-medium">{inviteInfo.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Phone (your login)</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    {inviteInfo.phone_number}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Company</p>
                  <p className="font-medium">{inviteInfo.company_name}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                We'll send a verification code to <strong>{inviteInfo.email}</strong> to confirm it's you.
              </p>
              <Button className="w-full h-12" variant="ocean" onClick={handleSendOtp} disabled={isLoading}>
                {isLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <><ArrowRight className="mr-2 h-4 w-4" /> Send Verification Code</>
                }
              </Button>
              <div className="text-center">
                <Link to={CUSTOMER_ROUTES.LOGIN} className="text-xs text-muted-foreground hover:text-foreground">
                  Already have an account? Login →
                </Link>
              </div>
            </div>
          )}

          {/* OTP entry */}
          {step === 'otp' && inviteInfo && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">Enter Verification Code</h1>
                <p className="text-muted-foreground text-sm">
                  Enter the 6-digit code sent to {inviteInfo.email}.
                </p>
              </div>
              <div className="flex flex-col items-center gap-4">
                <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={isLoading}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <InputOTPSlot key={i} index={i} className="h-12 w-12" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-xs text-muted-foreground">
                  Didn't receive it?{' '}
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isLoading}
                    className="text-primary hover:underline font-medium disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  type="button" variant="outline" className="flex-1 h-12"
                  onClick={() => { setStep('confirm'); setOtp(''); }}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  type="submit" className="flex-1 h-12" variant="ocean"
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate Account'}
                </Button>
              </div>
            </form>
          )}

          {/* Success — spinner shown while useEffect navigates */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle className="h-16 w-16 text-emerald-500" />
              <h2 className="text-2xl font-bold">Account Activated!</h2>
              <p className="text-muted-foreground">Redirecting you to your dashboard…</p>
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

        </Card>
      </div>
    </div>
  );
};

export default CustomerJoinPage;