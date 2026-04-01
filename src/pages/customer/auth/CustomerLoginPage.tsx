// src/pages/customer/auth/CustomerLoginPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import { Droplets, Phone, Mail, ArrowRight, Loader2, ChevronLeft, Shield, Sparkles, RotateCcw } from 'lucide-react';
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
  const [mounted,     setMounted]     = useState(false);

  const justLoggedIn = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const stepMeta = [
    { label: 'Phone',  short: '01' },
    { label: 'Email',  short: '02' },
    { label: 'Verify', short: '03' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --water-deep:   #031d40;
          --water-mid:    #0a3a6b;
          --water-bright: #0ea5e9;
          --water-glow:   #38bdf8;
          --water-pale:   #e0f2fe;
          --surface:      #ffffff;
          --text-primary: #0f172a;
          --text-muted:   #64748b;
          --text-faint:   #94a3b8;
          --border:       #e2e8f0;
          --border-focus: #0ea5e9;
          --success:      #10b981;
          --error:        #ef4444;
          --radius-sm:    10px;
          --radius-md:    16px;
          --radius-lg:    24px;
          --radius-xl:    32px;
        }

        .aq-root {
          font-family: 'Sora', sans-serif;
          min-height: 100dvh;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          -webkit-font-smoothing: antialiased;
        }

        /* ── HERO ── */
        .aq-hero {
          position: relative;
          width: 100%;
          height: 260px;
          overflow: hidden;
          flex-shrink: 0;
        }
        @media (min-width: 480px) { .aq-hero { height: 300px; } }

        .aq-hero-img {
          width: 100%; height: 100%;
          object-fit: cover;
          object-position: center 30%;
          display: block;
          transform: scale(1.04);
          transition: transform 8s ease-out;
        }
        .aq-hero-img.ready { transform: scale(1); }

        .aq-hero-gradient {
          position: absolute; inset: 0;
          background: linear-gradient(
            175deg,
            rgba(3,29,64,0.72) 0%,
            rgba(10,58,107,0.5) 45%,
            rgba(248,250,252,1) 100%
          );
        }

        /* ── Brand ── */
        .aq-brand {
          position: absolute;
          top: 20px; left: 20px;
          display: flex; align-items: center; gap: 11px;
        }
        .aq-brand-icon {
          width: 44px; height: 44px;
          border-radius: 14px;
          background: linear-gradient(145deg, #0ea5e9, #0369a1);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 18px rgba(14,165,233,0.45), inset 0 1px 0 rgba(255,255,255,0.2);
        }
        .aq-brand-name {
          font-size: 1.2rem; font-weight: 800;
          color: #fff;
          letter-spacing: -0.03em;
          text-shadow: 0 1px 6px rgba(0,0,0,0.25);
        }
        .aq-brand-dot {
          display: inline-block;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #38bdf8;
          margin-left: 1px;
          vertical-align: super;
        }

        /* ── Hero tagline ── */
        .aq-tagline {
          position: absolute;
          bottom: 60px; left: 0; right: 0;
          text-align: center;
          color: #fff;
          font-size: 1.55rem; font-weight: 700;
          letter-spacing: -0.03em;
          text-shadow: 0 2px 12px rgba(0,0,0,0.3);
          padding: 0 20px;
        }
        .aq-tagline span { color: #7dd3fc; }
        @media (min-width: 400px) { .aq-tagline { font-size: 1.75rem; } }

        /* ── Main body ── */
        .aq-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0 16px 40px;
          margin-top: -36px;
          position: relative;
          z-index: 10;
        }

        /* ── Card ── */
        .aq-card {
          width: 100%; max-width: 440px;
          background: var(--surface);
          border-radius: var(--radius-xl);
          box-shadow:
            0 0 0 1px rgba(14,165,233,0.08),
            0 4px 6px rgba(0,0,0,0.04),
            0 20px 50px rgba(3,29,64,0.1);
          overflow: hidden;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .aq-card.visible { opacity: 1; transform: translateY(0); }

        /* ── Step tracker ── */
        .aq-steps {
          display: flex;
          align-items: stretch;
          background: var(--water-deep);
        }
        .aq-step {
          flex: 1;
          padding: 14px 0 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          position: relative;
          transition: background 0.3s;
        }
        .aq-step::after {
          content: '';
          position: absolute;
          bottom: 0; left: 10%; right: 10%;
          height: 2px;
          border-radius: 2px;
          background: transparent;
          transition: background 0.3s;
        }
        .aq-step.active::after { background: var(--water-glow); }
        .aq-step.done::after   { background: var(--success); }

        .aq-step-num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.65rem; font-weight: 600;
          letter-spacing: 0.05em;
          color: rgba(255,255,255,0.25);
          transition: color 0.3s;
        }
        .aq-step.active .aq-step-num { color: var(--water-glow); }
        .aq-step.done   .aq-step-num { color: var(--success); }

        .aq-step-label {
          font-size: 0.7rem; font-weight: 600;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          transition: color 0.3s;
        }
        .aq-step.active .aq-step-label { color: #fff; }
        .aq-step.done   .aq-step-label { color: rgba(255,255,255,0.6); }

        /* ── Card inner ── */
        .aq-inner {
          padding: 28px 24px 28px;
        }
        @media (min-width: 400px) { .aq-inner { padding: 32px 28px 28px; } }

        /* ── Card header ── */
        .aq-header { margin-bottom: 26px; }
        .aq-pre-title {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.65rem; font-weight: 600;
          color: var(--water-bright);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 7px;
          display: flex; align-items: center; gap: 6px;
        }
        .aq-pre-title::before {
          content: '';
          display: inline-block;
          width: 16px; height: 1.5px;
          background: var(--water-bright);
          border-radius: 2px;
        }
        .aq-title {
          font-size: 1.55rem; font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.04em;
          line-height: 1.15;
          margin-bottom: 7px;
        }
        .aq-subtitle {
          font-size: 0.825rem;
          color: var(--text-muted);
          line-height: 1.55;
          font-weight: 400;
        }

        /* ── Fields ── */
        .aq-field { margin-bottom: 18px; }
        .aq-label {
          display: block;
          font-size: 0.75rem; font-weight: 600;
          color: var(--text-primary);
          letter-spacing: 0.03em;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .aq-input-wrap { position: relative; }
        .aq-input-icon {
          position: absolute;
          left: 14px; top: 50%;
          transform: translateY(-50%);
          color: var(--text-faint);
          pointer-events: none;
          width: 17px; height: 17px;
          transition: color 0.2s;
        }
        .aq-input {
          width: 100%;
          height: 54px;
          padding: 0 16px 0 44px;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          font-family: 'Sora', sans-serif;
          font-size: 0.95rem; font-weight: 500;
          color: var(--text-primary);
          background: #f8fafc;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          -webkit-appearance: none;
        }
        .aq-input:focus {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px rgba(14,165,233,0.12);
          background: #fff;
        }
        .aq-input:focus + .aq-input-icon,
        .aq-input-wrap:focus-within .aq-input-icon { color: var(--water-bright); }
        .aq-input::placeholder { color: #c0cdd8; font-weight: 400; }

        .aq-hint {
          margin-top: 7px;
          font-size: 0.75rem;
          color: var(--text-faint);
          line-height: 1.45;
          padding-left: 2px;
        }

        /* ── Security note ── */
        .aq-security {
          display: flex; align-items: center; gap: 7px;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: var(--radius-sm);
          padding: 10px 13px;
          margin-bottom: 20px;
        }
        .aq-security-text {
          font-size: 0.73rem; font-weight: 500;
          color: #166534;
          line-height: 1.4;
        }

        /* ── Buttons ── */
        .aq-btn-row {
          display: flex; gap: 10px;
          margin-top: 4px;
        }
        .aq-btn-primary {
          flex: 1;
          height: 54px;
          background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%);
          color: #fff;
          border: none;
          border-radius: var(--radius-md);
          font-family: 'Sora', sans-serif;
          font-size: 0.9rem; font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: all 0.2s;
          box-shadow: 0 4px 16px rgba(14,165,233,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
          -webkit-tap-highlight-color: transparent;
        }
        .aq-btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
          box-shadow: 0 6px 22px rgba(14,165,233,0.45);
          transform: translateY(-1px);
        }
        .aq-btn-primary:active:not(:disabled) { transform: translateY(0); box-shadow: none; }
        .aq-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

        .aq-btn-back {
          width: 54px; flex-shrink: 0;
          height: 54px;
          background: #f1f5f9;
          color: var(--text-muted);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          font-size: 0.9rem; font-weight: 600;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
          -webkit-tap-highlight-color: transparent;
        }
        .aq-btn-back:hover:not(:disabled) { background: #e2e8f0; border-color: #cbd5e1; }
        .aq-btn-back:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Spinner */
        @keyframes aq-spin { to { transform: rotate(360deg); } }
        .aq-spin { animation: aq-spin 0.75s linear infinite; }

        /* ── Footer ── */
        .aq-footer {
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid var(--border);
          text-align: center;
          display: flex; flex-direction: column; gap: 8px;
        }
        .aq-footer-text {
          font-size: 0.75rem; color: var(--text-faint); line-height: 1.5;
        }
        .aq-admin-link {
          font-size: 0.73rem; font-weight: 600;
          color: var(--text-faint);
          text-decoration: none;
          display: inline-flex; align-items: center; gap: 4px;
          transition: color 0.2s;
        }
        .aq-admin-link:hover { color: var(--water-bright); }

        /* ── Below card ── */
        .aq-below-card {
          width: 100%; max-width: 440px;
          margin-top: 14px;
          text-align: center;
        }
        .aq-powered {
          font-size: 0.68rem;
          color: var(--text-faint);
          letter-spacing: 0.04em;
        }
        .aq-powered a {
          color: var(--water-bright);
          text-decoration: none; font-weight: 600;
        }
        .aq-powered a:hover { text-decoration: underline; }

        /* ── Slide animation for step transitions ── */
        @keyframes aq-fadein {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
        .aq-step-content { animation: aq-fadein 0.28s ease both; }

        /* ─────────────────────────────────────────
           OTP STEP — restyled
        ───────────────────────────────────────── */

        /* Email badge */
        .aq-email-badge {
          display: flex; align-items: center; gap: 10px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 12px;
          padding: 11px 15px;
          width: 100%;
          margin-top: 10px;
        }
        .aq-email-badge-icon {
          width: 36px; height: 36px; flex-shrink: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, #0ea5e9, #0369a1);
          display: flex; align-items: center; justify-content: center;
        }
        .aq-email-badge-meta {
          display: flex; flex-direction: column; gap: 2px;
          overflow: hidden;
        }
        .aq-email-badge-label {
          font-size: 0.62rem; font-weight: 600;
          color: #0369a1;
          text-transform: uppercase; letter-spacing: 0.07em;
        }
        .aq-email-badge-addr {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.82rem; font-weight: 500;
          color: #0c4a6e;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* OTP section wrapper */
        .aq-otp-section {
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .aq-otp-section-label {
          font-size: 0.7rem; font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.08em;
          align-self: flex-start;
          margin-bottom: 16px;
        }

        /* Larger OTP slot overrides */
        [data-input-otp-slot] {
          border-radius: 14px !important;
          font-family: 'JetBrains Mono', monospace !important;
          font-weight: 600 !important;
          font-size: 1.5rem !important;
          width: 52px !important;
          height: 64px !important;
          border-width: 2px !important;
          transition: border-color 0.15s, box-shadow 0.15s !important;
        }
        [data-input-otp-slot][data-active] {
          border-color: var(--water-bright) !important;
          box-shadow: 0 0 0 3px rgba(14,165,233,0.15) !important;
        }

        /* Progress bar */
        .aq-otp-progress-row {
          display: flex; align-items: center;
          width: 100%; margin-top: 14px; gap: 10px;
        }
        .aq-otp-progress-bar {
          flex: 1; height: 4px; border-radius: 999px;
          background: var(--border); overflow: hidden;
        }
        .aq-otp-progress-fill {
          height: 100%; border-radius: 999px;
          background: var(--water-bright);
          transition: width 0.25s ease;
        }
        .aq-otp-progress-count {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.68rem; font-weight: 600;
          color: var(--text-muted);
          white-space: nowrap; min-width: 28px; text-align: right;
        }

        /* Resend row */
        .aq-otp-resend-row {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          font-size: 0.78rem; color: var(--text-muted);
          margin-top: 16px;
        }
        .aq-resend-btn {
          display: inline-flex; align-items: center; gap: 5px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 999px;
          padding: 6px 14px;
          font-family: 'Sora', sans-serif;
          font-size: 0.75rem; font-weight: 600;
          color: var(--water-bright);
          cursor: pointer;
          transition: opacity 0.2s, background 0.2s;
          -webkit-tap-highlight-color: transparent;
        }
        .aq-resend-btn:hover:not(:disabled) { background: #e0f2fe; }
        .aq-resend-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      `}</style>

      <div className="aq-root">

        {/* ── Hero ── */}
        <div className="aq-hero">
          <img
            className={`aq-hero-img${mounted ? ' ready' : ''}`}
            src="https://static.vecteezy.com/system/resources/thumbnails/027/603/215/small_2x/pouring-mineral-water-from-blue-bottle-into-clear-glass-on-abstract-grey-background-photo.jpg"
            alt="Pure drinking water"
          />
          <div className="aq-hero-gradient" />
          <div className="aq-brand">
            <div className="aq-brand-icon">
              <Droplets size={20} color="#fff" />
            </div>
            <span className="aq-brand-name">
              AquaTrack<span className="aq-brand-dot" />
            </span>
          </div>
          <div className="aq-tagline">
            Pure water,<br /><span>delivered fresh.</span>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="aq-body">
          <div className={`aq-card${mounted ? ' visible' : ''}`}>

            {/* Step tracker bar */}
            <div className="aq-steps">
              {stepMeta.map((s, i) => (
                <div
                  key={s.label}
                  className={`aq-step ${stepIndex === i ? 'active' : stepIndex > i ? 'done' : ''}`}
                >
                  <span className="aq-step-num">
                    {stepIndex > i ? '✓' : s.short}
                  </span>
                  <span className="aq-step-label">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Card content */}
            <div className="aq-inner">

              {/* ── Step 1: Phone ── */}
              {step === 'phone' && (
                <form key="phone" className="aq-step-content" onSubmit={handlePhoneSubmit}>
                  <div className="aq-header">
                    <p className="aq-pre-title">Customer Portal</p>
                    <h1 className="aq-title">What's your number?</h1>
                    <p className="aq-subtitle">Enter the phone number your distributor registered for your account.</p>
                  </div>

                  <div className="aq-field">
                    <label className="aq-label" htmlFor="phone">Phone Number</label>
                    <div className="aq-input-wrap">
                      <input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="+254 7XX XXX XXX"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value)}
                        className="aq-input"
                        autoFocus
                        required
                      />
                      <Phone className="aq-input-icon" style={{ left: 14 }} />
                    </div>
                    <p className="aq-hint">Include country code — e.g. <strong>+254</strong>712345678</p>
                  </div>

                  <div className="aq-security">
                    <Shield size={14} color="#16a34a" style={{ flexShrink: 0 }} />
                    <p className="aq-security-text">Your number is only used to verify your identity.</p>
                  </div>

                  <div className="aq-btn-row">
                    <button
                      type="submit"
                      className="aq-btn-primary"
                      disabled={!phoneNumber.trim().startsWith('+')}
                    >
                      Continue <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              )}

              {/* ── Step 2: Email ── */}
              {step === 'email' && (
                <form key="email" className="aq-step-content" onSubmit={handleSendOtp}>
                  <div className="aq-header">
                    <p className="aq-pre-title">Verification</p>
                    <h1 className="aq-title">Confirm your email</h1>
                    <p className="aq-subtitle">This must match the email your distributor used when registering you.</p>
                  </div>

                  <div className="aq-field">
                    <label className="aq-label" htmlFor="email">Email Address</label>
                    <div className="aq-input-wrap">
                      <input
                        id="email"
                        type="email"
                        inputMode="email"
                        placeholder="you@example.com"
                        value={emailInput}
                        onChange={e => setEmailInput(e.target.value)}
                        className="aq-input"
                        disabled={isLoading}
                        autoFocus
                        required
                      />
                      <Mail className="aq-input-icon" style={{ left: 14 }} />
                    </div>
                    <p className="aq-hint">We'll send a one-time code to this address.</p>
                  </div>

                  <div className="aq-btn-row">
                    <button
                      type="button"
                      className="aq-btn-back"
                      onClick={() => setStep('phone')}
                      disabled={isLoading}
                      aria-label="Go back"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="submit"
                      className="aq-btn-primary"
                      disabled={isLoading || !emailInput.trim()}
                    >
                      {isLoading
                        ? <Loader2 size={18} className="aq-spin" />
                        : <><span>Send Code</span><ArrowRight size={16} /></>
                      }
                    </button>
                  </div>
                </form>
              )}

              {/* ── Step 3: OTP ── */}
              {step === 'otp' && (
                <form key="otp" className="aq-step-content" onSubmit={handleVerifyOtp}>
                  <div className="aq-header">
                    <p className="aq-pre-title">One-Time Code</p>
                    <h1 className="aq-title">Check your inbox</h1>
                    <p className="aq-subtitle">
                      We sent a 6-digit code to your email. It expires in 10 minutes.
                    </p>

                    {/* Email badge */}
                    <div className="aq-email-badge">
                      <div className="aq-email-badge-icon">
                        <Mail size={16} color="#fff" />
                      </div>
                      <div className="aq-email-badge-meta">
                        <span className="aq-email-badge-label">Code sent to</span>
                        <span className="aq-email-badge-addr">{emailInput}</span>
                      </div>
                    </div>
                  </div>

                  {/* OTP section */}
                  <div className="aq-otp-section">
                    <span className="aq-otp-section-label">Enter your 6-digit code</span>

                    <InputOTP maxLength={6} value={otp} onChange={setOtp} disabled={isLoading}>
                      <InputOTPGroup>
                        {[0,1,2,3,4,5].map(i => (
                          <InputOTPSlot key={i} index={i} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>

                    {/* Progress bar */}
                    <div className="aq-otp-progress-row">
                      <div className="aq-otp-progress-bar">
                        <div
                          className="aq-otp-progress-fill"
                          style={{ width: `${(otp.length / 6) * 100}%` }}
                        />
                      </div>
                      <span className="aq-otp-progress-count">{otp.length} / 6</span>
                    </div>

                    {/* Resend */}
                    <div className="aq-otp-resend-row">
                      <span>Didn't receive it?</span>
                      <button
                        type="button"
                        className="aq-resend-btn"
                        onClick={handleResendOtp}
                        disabled={isLoading}
                      >
                        <RotateCcw size={12} /> Resend code
                      </button>
                    </div>
                  </div>

                  <div className="aq-btn-row" style={{ marginTop: 20 }}>
                    <button
                      type="button"
                      className="aq-btn-back"
                      onClick={() => { setStep('email'); setOtp(''); }}
                      disabled={isLoading}
                      aria-label="Go back"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="submit"
                      className="aq-btn-primary"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading
                        ? <Loader2 size={18} className="aq-spin" />
                        : <><Sparkles size={15} /><span>Verify &amp; Sign In</span></>
                      }
                    </button>
                  </div>
                </form>
              )}

              {/* Footer */}
              <div className="aq-footer">
                <p className="aq-footer-text">
                  First time? Look for an invite email from your distributor.
                </p>
                <Link to="/login" className="aq-admin-link">
                  Staff / Admin login <ArrowRight size={11} />
                </Link>
              </div>

            </div>
          </div>

          <div className="aq-below-card">
            <p className="aq-powered">
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