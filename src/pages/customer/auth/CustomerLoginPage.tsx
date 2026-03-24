// src/pages/customer/auth/CustomerLoginPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import { Droplets, Phone, Mail, ArrowRight, Loader2 } from 'lucide-react';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// Plain axios — no interceptors, no auth header.
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

type Step = 'phone' | 'email' | 'otp';

const CustomerLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loginAsCustomer, user } = useAuth();

  const [step,        setStep]        = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailInput,  setEmailInput]  = useState('');
  const [otp,         setOtp]         = useState('');
  const [isLoading,   setIsLoading]   = useState(false);

  // ── Track whether THIS login flow triggered the user state change ─────────
  // Without this guard, the useEffect below would fire immediately on mount
  // if a customer is already logged in (user is set from localStorage), causing
  // an infinite loop: login page → dashboard → logout → login page → ...
  // We only want to navigate when loginAsCustomer() was called from THIS page.
  const justLoggedIn = useRef(false);

  useEffect(() => {
    if (justLoggedIn.current && user && user.role === 'customer') {
      justLoggedIn.current = false;
      navigate(CUSTOMER_ROUTES.DASHBOARD, { replace: true });
    }
  }, [user, navigate]);

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim().startsWith('+')) return;
    setStep('email');
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setIsLoading(true);
    try {
      await publicApi.post('/customer/auth/send-otp/', {
        phone: phoneNumber,
        email: emailInput.trim(),
      });
      setStep('otp');
      toast({
        title: 'Code sent!',
        description: `Check ${emailInput} for your 6-digit verification code.`,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { non_field_errors?: string[] } } })
          ?.response?.data?.non_field_errors?.[0] ??
        (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ??
        'Could not send code. Check your phone number and email, then try again.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setIsLoading(true);
    try {
      const { data } = await publicApi.post('/customer/auth/verify-otp/', {
        phone:    phoneNumber,
        otp_code: otp,
      });

      // Clear any stale staff session first
      localStorage.removeItem('aquatrack_token');
      localStorage.removeItem('aquatrack_refresh_token');
      localStorage.removeItem('aquatrack_user');
      localStorage.removeItem('customer_data');

      const nameParts = (data.customer.full_name ?? '').trim().split(/\s+/);
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

      // Mark that navigation was triggered by this login flow, then set user.
      // The useEffect above will fire on the next render and navigate.
      justLoggedIn.current = true;
      loginAsCustomer(customerUser, data.tokens.access, data.tokens.refresh);

      toast({ title: 'Welcome back!', description: 'You have successfully logged in.' });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { non_field_errors?: string[] } } })
          ?.response?.data?.non_field_errors?.[0] ??
        (err as { response?: { data?: { error?: string } } })
          ?.response?.data?.error ??
        'Invalid or expired code. Please try again.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      await publicApi.post('/customer/auth/send-otp/', {
        phone: phoneNumber,
        email: emailInput.trim(),
      });
      toast({ title: 'Code resent', description: `A new code was sent to ${emailInput}.` });
    } catch {
      toast({ title: 'Error', description: 'Failed to resend code.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const stepIndex = step === 'phone' ? 0 : step === 'email' ? 1 : 2;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=DM+Sans:wght@400;500&display=swap');
        .login-root { font-family: 'DM Sans', sans-serif; min-height: 100dvh; display: flex; flex-direction: column; background: #f0f7ff; }
        .hero-strip { position: relative; width: 100%; height: 220px; overflow: hidden; flex-shrink: 0; }
        @media (min-width: 768px) { .hero-strip { height: 300px; } }
        .hero-strip img { width: 100%; height: 100%; object-fit: cover; object-position: center 40%; display: block; }
        .hero-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,82,158,0.55) 0%, rgba(0,148,213,0.35) 60%, rgba(240,247,255,1) 100%); }
        .hero-logo { position: absolute; top: 18px; left: 18px; display: flex; align-items: center; gap: 10px; }
        .logo-icon { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #0094d5, #00529e); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,148,213,0.4); }
        .logo-text { font-family: 'Outfit', sans-serif; font-weight: 700; font-size: 1.25rem; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.3); letter-spacing: -0.02em; }
        .hero-tagline { position: absolute; bottom: 52px; left: 0; right: 0; text-align: center; color: #fff; font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; text-shadow: 0 2px 8px rgba(0,0,0,0.3); letter-spacing: -0.02em; padding: 0 16px; }
        @media (min-width: 768px) { .hero-tagline { font-size: 2rem; bottom: 70px; } }
        .content-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 0 16px 32px; margin-top: -28px; position: relative; z-index: 10; }
        .login-card { width: 100%; max-width: 440px; background: #fff; border-radius: 20px; box-shadow: 0 8px 40px rgba(0,82,158,0.12), 0 2px 8px rgba(0,0,0,0.06); padding: 28px 24px 24px; border: 1px solid rgba(0,148,213,0.1); }
        @media (min-width: 480px) { .login-card { padding: 36px 32px 28px; } }
        .steps-bar { display: flex; align-items: center; justify-content: center; gap: 0; margin-bottom: 28px; }
        .step-dot { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-size: 0.8rem; font-weight: 600; transition: all 0.3s ease; flex-shrink: 0; }
        .step-dot.active { background: linear-gradient(135deg, #0094d5, #00529e); color: #fff; box-shadow: 0 3px 10px rgba(0,148,213,0.4); }
        .step-dot.done { background: #0094d5; color: #fff; }
        .step-dot.pending { background: #e8f4fc; color: #a0b8cc; border: 2px solid #d0e8f5; }
        .step-line { height: 2px; width: 40px; transition: background 0.3s; }
        .step-line.done { background: #0094d5; }
        .step-line.pending { background: #dde8f0; }
        .card-header { text-align: center; margin-bottom: 24px; }
        .card-title { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; color: #0d2d4a; margin: 0 0 6px; letter-spacing: -0.03em; }
        .card-subtitle { font-size: 0.875rem; color: #6b8ba4; margin: 0; line-height: 1.5; }
        .field-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; }
        .field-label { font-size: 0.8rem; font-weight: 600; color: #2d5878; letter-spacing: 0.04em; text-transform: uppercase; }
        .input-wrapper { position: relative; }
        .input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #0094d5; width: 16px; height: 16px; pointer-events: none; }
        .styled-input { width: 100%; height: 52px; padding-left: 42px; padding-right: 16px; border: 1.5px solid #d0e8f5; border-radius: 12px; font-size: 0.95rem; font-family: 'DM Sans', sans-serif; color: #0d2d4a; background: #f7fbff; outline: none; transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box; }
        .styled-input:focus { border-color: #0094d5; box-shadow: 0 0 0 3px rgba(0,148,213,0.12); background: #fff; }
        .styled-input::placeholder { color: #a8c0d0; }
        .field-hint { font-size: 0.75rem; color: #8fafc4; margin: 0; line-height: 1.4; }
        .btn-row { display: flex; gap: 10px; margin-top: 8px; }
        .btn-primary { flex: 1; height: 52px; background: linear-gradient(135deg, #0094d5, #00529e); color: #fff; border: none; border-radius: 12px; font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s; box-shadow: 0 4px 14px rgba(0,148,213,0.35); letter-spacing: 0.01em; }
        .btn-primary:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,148,213,0.4); }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-outline { flex: 1; height: 52px; background: transparent; color: #00529e; border: 1.5px solid #b8d8ee; border-radius: 12px; font-family: 'Outfit', sans-serif; font-size: 0.95rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s, border-color 0.2s; }
        .btn-outline:hover:not(:disabled) { background: #eef6fc; border-color: #0094d5; }
        .btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
        .otp-center { display: flex; flex-direction: column; align-items: center; gap: 14px; margin-bottom: 4px; }
        .resend-text { font-size: 0.8rem; color: #8fafc4; text-align: center; }
        .resend-btn { background: none; border: none; color: #0094d5; font-weight: 600; cursor: pointer; padding: 0; font-family: inherit; font-size: inherit; text-decoration: underline; }
        .resend-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .card-footer { margin-top: 24px; padding-top: 18px; border-top: 1px solid #eaf3f9; text-align: center; display: flex; flex-direction: column; gap: 6px; }
        .footer-hint { font-size: 0.75rem; color: #8fafc4; line-height: 1.5; }
        .admin-link { font-size: 0.75rem; color: #8fafc4; text-decoration: none; }
        .admin-link:hover { color: #0094d5; }
        .credit-bar { width: 100%; max-width: 440px; margin-top: 16px; text-align: center; }
        .credit-text { font-size: 0.7rem; color: #a0b8cc; letter-spacing: 0.03em; }
        .credit-text a { color: #0094d5; text-decoration: none; font-weight: 600; }
        .credit-text a:hover { text-decoration: underline; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="login-root">
        <div className="hero-strip">
          <img
            src="https://static.vecteezy.com/system/resources/thumbnails/027/603/215/small_2x/pouring-mineral-water-from-blue-bottle-into-clear-glass-on-abstract-grey-background-photo.jpg"
            alt="Pure drinking water"
          />
          <div className="hero-overlay" />
          <div className="hero-logo">
            <div className="logo-icon"><Droplets size={20} color="#fff" /></div>
            <span className="logo-text">AquaTrack</span>
          </div>
          <div className="hero-tagline">Pure water, delivered.</div>
        </div>

        <div className="content-wrap">
          <div className="login-card">

            <div className="steps-bar">
              {(['phone', 'email', 'otp'] as Step[]).map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 && <div className={`step-line ${stepIndex >= i ? 'done' : 'pending'}`} />}
                  <div className={`step-dot ${stepIndex === i ? 'active' : stepIndex > i ? 'done' : 'pending'}`}>
                    {stepIndex > i ? '✓' : i + 1}
                  </div>
                </React.Fragment>
              ))}
            </div>

            <div className="card-header">
              <h1 className="card-title">
                {step === 'phone' && 'Welcome Back!'}
                {step === 'email' && 'Confirm Your Email'}
                {step === 'otp'   && 'Enter Your Code'}
              </h1>
              <p className="card-subtitle">
                {step === 'phone' && 'Enter your registered phone number to continue.'}
                {step === 'email' && 'This must match the email your distributor registered for you.'}
                {step === 'otp'   && `We sent a 6-digit code to ${emailInput}.`}
              </p>
            </div>

            {step === 'phone' && (
              <form onSubmit={handlePhoneSubmit}>
                <div className="field-group">
                  <label className="field-label" htmlFor="phone">Phone Number</label>
                  <div className="input-wrapper">
                    <Phone className="input-icon" />
                    <input id="phone" type="tel" placeholder="+254712345678"
                      value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                      className="styled-input" required />
                  </div>
                  <p className="field-hint">Include your country code, e.g. <strong>+254</strong>712345678</p>
                </div>
                <div className="btn-row">
                  <button type="submit" className="btn-primary" disabled={!phoneNumber.trim().startsWith('+')}>
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {step === 'email' && (
              <form onSubmit={handleSendOtp}>
                <div className="field-group">
                  <label className="field-label" htmlFor="email">Email Address</label>
                  <div className="input-wrapper">
                    <Mail className="input-icon" />
                    <input id="email" type="email" placeholder="you@example.com"
                      value={emailInput} onChange={e => setEmailInput(e.target.value)}
                      className="styled-input" disabled={isLoading} required />
                  </div>
                  <p className="field-hint">Must match the email your distributor used when registering you.</p>
                </div>
                <div className="btn-row">
                  <button type="button" className="btn-outline" onClick={() => setStep('phone')} disabled={isLoading}>Back</button>
                  <button type="submit" className="btn-primary" disabled={isLoading || !emailInput.trim()}>
                    {isLoading ? <Loader2 size={18} className="spin" /> : <><span>Send Code</span><ArrowRight size={16} /></>}
                  </button>
                </div>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp}>
                <div className="otp-center">
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={isLoading}>
                    <InputOTPGroup>
                      {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="h-12 w-12" />)}
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="resend-text">
                    Didn't receive it?{' '}
                    <button type="button" className="resend-btn" onClick={handleResendOtp} disabled={isLoading}>
                      Resend code
                    </button>
                  </p>
                </div>
                <div className="btn-row" style={{ marginTop: 16 }}>
                  <button type="button" className="btn-outline"
                    onClick={() => { setStep('email'); setOtp(''); }} disabled={isLoading}>Back</button>
                  <button type="submit" className="btn-primary" disabled={isLoading || otp.length !== 6}>
                    {isLoading ? <Loader2 size={18} className="spin" /> : 'Verify & Login'}
                  </button>
                </div>
              </form>
            )}

            <div className="card-footer">
              <p className="footer-hint">First time here? Check your email for an invite from your distributor.</p>
              <Link to="/login" className="admin-link">Admin / Staff Login →</Link>
            </div>
          </div>

          <div className="credit-bar">
            <p className="credit-text">
              Powered by{' '}
              <a href="https://ari-gram-technologies.netlify.app/" target="_blank" rel="noopener noreferrer">
                ARI gram Technologies
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default CustomerLoginPage;