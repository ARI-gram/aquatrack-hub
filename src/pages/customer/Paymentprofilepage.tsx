/**
 * Customer Payment Profile Page
 * Route: /customer/payment-profile
 *
 * Lets customers configure their preferred payment method and M-Pesa number.
 * This page is shown when payment profile is not yet set up.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Wallet,
  Banknote,
  Smartphone,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '@/api/axios.config';
import { CUSTOMER_API_ENDPOINTS } from '@/api/customerEndpoints';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaymentProfile {
  preferred_payment_method: string;
  mpesa_phone: string;
  has_credit: boolean;
  credit_terms_display: string;
  available_credit: string;
  currency: string;
}

interface DRFErrorResponse {
  non_field_errors?: string[];
  detail?: string;
  [key: string]: string[] | string | undefined;
}

function extractError(data: DRFErrorResponse): string {
  if (data.non_field_errors?.[0]) return data.non_field_errors[0];
  if (data.detail) return data.detail;
  const key = Object.keys(data)[0];
  if (key) {
    const val = data[key];
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return String(val[0]);
  }
  return 'Something went wrong. Please try again.';
}

// ── Payment method config ─────────────────────────────────────────────────────

interface PaymentOption {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  requiresMpesa: boolean;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    value: 'MPESA',
    label: 'M-Pesa',
    description: 'Pay via STK push on your phone',
    icon: <Smartphone className="h-5 w-5 text-green-600" />,
    requiresMpesa: true,
  },
  {
    value: 'CASH',
    label: 'Cash on Delivery',
    description: 'Pay the driver when your order arrives',
    icon: <Banknote className="h-5 w-5 text-amber-600" />,
    requiresMpesa: false,
  },
  {
    value: 'WALLET',
    label: 'Wallet',
    description: 'Deduct from your AquaTrack wallet balance',
    icon: <Wallet className="h-5 w-5 text-blue-600" />,
    requiresMpesa: false,
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

const PaymentProfilePage: React.FC = () => {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<PaymentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [selectedMethod, setSelectedMethod] = useState<string>('CASH');
  const [mpesaPhone, setMpesaPhone] = useState<string>('');

  // ── Load existing profile ─────────────────────────────────────────────────

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await axiosInstance.get<PaymentProfile>(
          CUSTOMER_API_ENDPOINTS.PROFILE.PAYMENT_PROFILE
        );
        setProfile(res.data);
        setSelectedMethod(res.data.preferred_payment_method);
        setMpesaPhone(res.data.mpesa_phone ?? '');
      } catch {
        // 404 = not set up yet — that's fine, show the form
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (selectedMethod === 'MPESA' && !mpesaPhone.trim()) {
      toast.error('Please enter your M-Pesa phone number.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, string> = {
        preferred_payment_method: selectedMethod,
      };
      if (selectedMethod === 'MPESA') {
        payload.mpesa_phone = mpesaPhone.trim();
      }

      const res = await axiosInstance.post<PaymentProfile>(
        CUSTOMER_API_ENDPOINTS.PROFILE.PAYMENT_PROFILE,
        payload
      );
      setProfile(res.data);
      toast.success('Payment details saved!');
      navigate(-1);
    } catch (error: unknown) {
      let msg = 'Could not save payment details.';
      if (
        error !== null &&
        typeof error === 'object' &&
        'response' in error
      ) {
        const errObj = error as { response?: { data?: DRFErrorResponse } };
        if (errObj.response?.data) {
          msg = extractError(errObj.response.data);
        }
      }
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <CustomerLayout title="Payment Details" showBackButton>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout title="Payment Details" showBackButton>
      <div className="max-w-lg mx-auto space-y-6">

        {/* Current status */}
        {profile && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-900 text-sm">
                Payment details configured
              </p>
              <p className="text-xs text-green-700">
                Default: {profile.preferred_payment_method}
                {profile.mpesa_phone ? ` (${profile.mpesa_phone})` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Method selection */}
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Preferred Payment Method</h3>
          <RadioGroup
            value={selectedMethod}
            onValueChange={setSelectedMethod}
            className="space-y-3"
          >
            {PAYMENT_OPTIONS.map(opt => (
              <div
                key={opt.value}
                className={`flex items-start gap-3 p-4 border rounded-xl transition-colors ${
                  selectedMethod === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border'
                }`}
              >
                <RadioGroupItem
                  value={opt.value}
                  id={`method-${opt.value}`}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`method-${opt.value}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    {opt.icon}
                    <span className="font-medium text-sm">{opt.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </Label>
              </div>
            ))}
          </RadioGroup>

          {/* M-Pesa number input */}
          {selectedMethod === 'MPESA' && (
            <div className="mt-4 space-y-2">
              <Label htmlFor="mpesa-phone">M-Pesa Phone Number</Label>
              <Input
                id="mpesa-phone"
                type="tel"
                placeholder="+254712345678"
                value={mpesaPhone}
                onChange={e => setMpesaPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Include country code. This number will receive the STK push when you order.
              </p>
            </div>
          )}
        </Card>

        {/* Credit info (read-only — distributor managed) */}
        {profile?.has_credit && (
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <h3 className="font-semibold text-sm">Credit Account</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Your distributor has enabled Pay Later for your account.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-xs text-muted-foreground mb-1">Available Credit</p>
                <p className="font-semibold text-sm">
                  KES {parseFloat(profile.available_credit).toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <p className="text-xs text-muted-foreground mb-1">Terms</p>
                <p className="font-semibold text-sm">{profile.credit_terms_display}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Save */}
        <Button
          variant="ocean"
          className="w-full h-12"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            'Save Payment Details'
          )}
        </Button>
      </div>
    </CustomerLayout>
  );
};

export default PaymentProfilePage;