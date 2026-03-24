import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import { CUSTOMER_PRICING } from '@/constants/pricing';
import {
  Droplets, Phone, Mail, ArrowRight, ArrowLeft, Loader2,
  User, MapPin, Package, RefreshCw, Check, Wallet, CreditCard, Banknote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  InputOTP, InputOTPGroup, InputOTPSlot,
} from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CustomerType } from '@/types/customer.types';
import axiosInstance from '@/api/axios.config';

type Step = 'phone' | 'email' | 'otp' | 'info' | 'type' | 'bottles' | 'payment' | 'confirm';

interface RegistrationData {
  phoneNumber: string;
  email: string;
  otp: string;
  fullName: string;
  address: string;
  customerType: CustomerType;
  bottleQuantity: number;
  paymentMethod: 'WALLET' | 'CASH' | 'CREDIT_ACCOUNT';
  initialWalletBalance: number;
  termsAccepted: boolean;
}

const CustomerRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<RegistrationData>({
    phoneNumber: '',
    email: '',
    otp: '',
    fullName: '',
    address: '',
    customerType: CustomerType.REFILL_CUSTOMER,
    bottleQuantity: 5,
    paymentMethod: 'WALLET',
    initialWalletBalance: 50,
    termsAccepted: false,
  });

  const steps: Step[] = ['phone', 'email', 'otp', 'info', 'type', 'bottles', 'payment', 'confirm'];
  const currentStepIndex = steps.indexOf(step);

  const updateData = (updates: Partial<RegistrationData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      if (steps[nextIndex] === 'bottles' && data.customerType === CustomerType.ONETIME_CUSTOMER) {
        setStep('payment');
      } else {
        setStep(steps[nextIndex]);
      }
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      if (steps[prevIndex] === 'bottles' && data.customerType === CustomerType.ONETIME_CUSTOMER) {
        setStep('type');
      } else {
        setStep(steps[prevIndex]);
      }
    }
  };

  // ─── Step 1: Phone — just collect and move on ─────────────────────────────
  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.phoneNumber.trim()) return;
    setStep('email');
  };

  // ─── Step 2: Email + send OTP ─────────────────────────────────────────────
  // NOTE: For self-registration the backend sends OTP to any valid email.
  // The email-must-match check only applies to the invite/join flow.
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.email.trim()) return;
    setIsLoading(true);

    try {
      // First register the customer so a Customer record exists,
      // then the send-otp endpoint can find them by phone.
      // If your backend requires registration before OTP, do it here.
      // Otherwise if send-otp works for new users too, just call it directly.
      await axiosInstance.post('/customer/auth/send-otp/', {
        phone: data.phoneNumber,
        email: data.email.trim(),
      });

      setStep('otp');
      toast({
        title: 'Code sent!',
        description: `Check ${data.email} for your verification code.`,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { non_field_errors?: string[] } } })
          ?.response?.data?.non_field_errors?.[0] ??
        (err as { response?: { data?: { phone?: string[] } } })
          ?.response?.data?.phone?.[0] ??
        (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ??
        'Could not send code. Please check your details and try again.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 3: Verify OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (data.otp.length !== 6) return;
    setIsLoading(true);

    try {
      const { data: result } = await axiosInstance.post('/customer/auth/verify-otp/', {
        phone: data.phoneNumber,
        otp_code: data.otp,
      });

      // Store tokens early — subsequent steps may need auth
      localStorage.setItem('aquatrack_token', result.tokens.access);
      localStorage.setItem('aquatrack_refresh_token', result.tokens.refresh);
      localStorage.setItem('customer_data', JSON.stringify(result.customer));

      nextStep();
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

  // ─── Final step: Complete registration ────────────────────────────────────
  const handleCompleteRegistration = async () => {
    if (!data.termsAccepted) {
      toast({ title: 'Please accept the terms to continue', variant: 'destructive' });
      return;
    }
    setIsLoading(true);

    try {
      // Update the customer profile with name, address, type etc.
      await axiosInstance.put('/customer/profile/', {
        full_name: data.fullName,
        email: data.email,
      });

      toast({ title: '🎉 Welcome to AquaTrack!', description: 'Your account is ready.' });
      navigate(CUSTOMER_ROUTES.DASHBOARD);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ??
        'Registration failed. Please try again.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotal = () => {
    if (data.customerType === CustomerType.ONETIME_CUSTOMER) return 0;
    return data.bottleQuantity * CUSTOMER_PRICING.BOTTLE_PURCHASE_PRICE +
           data.bottleQuantity * CUSTOMER_PRICING.BOTTLE_DEPOSIT;
  };

  const renderStep = () => {
    switch (step) {

      // ── Phone ──────────────────────────────────────────────────────────────
      case 'phone':
        return (
          <form onSubmit={handlePhoneSubmit} className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Enter your phone number</h2>
              <p className="text-sm text-muted-foreground">We'll use this to identify your account</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+254 712 345 678"
                  value={data.phoneNumber}
                  onChange={(e) => updateData({ phoneNumber: e.target.value })}
                  className="pl-10 h-12"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12" variant="ocean">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        );

      // ── Email ──────────────────────────────────────────────────────────────
      case 'email':
        return (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Enter your email</h2>
              <p className="text-sm text-muted-foreground">
                We'll send your verification code here
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={data.email}
                  onChange={(e) => updateData({ email: e.target.value })}
                  className="pl-10 h-12"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setStep('phone')} disabled={isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button type="submit" className="flex-1 h-12" variant="ocean" disabled={isLoading || !data.email.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send Code <ArrowRight className="ml-2 h-4 w-4" /></>}
              </Button>
            </div>
          </form>
        );

      // ── OTP ────────────────────────────────────────────────────────────────
      case 'otp':
        return (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Verify your email</h2>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to <strong>{data.email}</strong>
              </p>
            </div>
            <div className="flex flex-col items-center gap-4">
              <InputOTP maxLength={6} value={data.otp} onChange={(v) => updateData({ otp: v })}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-12" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
                💡 Dev mode: check your Django terminal for the OTP code
              </p>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => { setStep('email'); updateData({ otp: '' }); }} disabled={isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button type="submit" className="flex-1 h-12" variant="ocean" disabled={isLoading || data.otp.length !== 6}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </Button>
            </div>
          </form>
        );

      // ── Info ───────────────────────────────────────────────────────────────
      case 'info':
        return (
          <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Tell us about yourself</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="name" placeholder="Ahmed Mohammed" value={data.fullName} onChange={(e) => updateData({ fullName: e.target.value })} className="pl-10 h-12" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Delivery Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="address" placeholder="123 Main St, Nairobi" value={data.address} onChange={(e) => updateData({ address: e.target.value })} className="pl-10 h-12" required />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1 h-12" onClick={prevStep}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button type="submit" className="flex-1 h-12" variant="ocean">
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </form>
        );

      // ── Type ───────────────────────────────────────────────────────────────
      case 'type':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Choose your plan</h2>
              <p className="text-sm text-muted-foreground">How would you like to order?</p>
            </div>
            <div className="grid gap-4">
              <Card
                className={cn('p-4 cursor-pointer transition-all border-2', data.customerType === CustomerType.REFILL_CUSTOMER ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}
                onClick={() => updateData({ customerType: CustomerType.REFILL_CUSTOMER })}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-success/10"><RefreshCw className="h-6 w-6 text-success" /></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Refill Plan</h3>
                      <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded">Recommended</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">${CUSTOMER_PRICING.REFILL_PRICE} per refill • Eco-friendly • Track your bottles</p>
                    <p className="text-xs text-muted-foreground mt-2">One-time bottle purchase required (from ${CUSTOMER_PRICING.BOTTLE_PURCHASE_PRICE * 3})</p>
                  </div>
                  {data.customerType === CustomerType.REFILL_CUSTOMER && <Check className="h-5 w-5 text-primary" />}
                </div>
              </Card>

              <Card
                className={cn('p-4 cursor-pointer transition-all border-2', data.customerType === CustomerType.ONETIME_CUSTOMER ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}
                onClick={() => updateData({ customerType: CustomerType.ONETIME_CUSTOMER })}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-accent/10"><Package className="h-6 w-6 text-accent" /></div>
                  <div className="flex-1">
                    <h3 className="font-semibold">One-Time Purchase</h3>
                    <p className="text-sm text-muted-foreground mt-1">${CUSTOMER_PRICING.NEW_BOTTLE_PRICE} per bottle • No commitment</p>
                  </div>
                  {data.customerType === CustomerType.ONETIME_CUSTOMER && <Check className="h-5 w-5 text-primary" />}
                </div>
              </Card>
            </div>
            <p className="text-xs text-center text-muted-foreground">💡 You can always switch plans later</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={prevStep}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button className="flex-1 h-12" variant="ocean" onClick={nextStep}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </div>
        );

      // ── Bottles ────────────────────────────────────────────────────────────
      case 'bottles':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Purchase Bottles</h2>
              <p className="text-sm text-muted-foreground">How many refillable bottles do you need?</p>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="icon" onClick={() => updateData({ bottleQuantity: Math.max(3, data.bottleQuantity - 1) }) } disabled={data.bottleQuantity <= 3}>-</Button>
              <span className="text-4xl font-bold w-16 text-center">{data.bottleQuantity}</span>
              <Button variant="outline" size="icon" onClick={() => updateData({ bottleQuantity: Math.min(20, data.bottleQuantity + 1) })} disabled={data.bottleQuantity >= 20}>+</Button>
            </div>
            <p className="text-center text-sm text-muted-foreground">Min: 3 bottles • Recommended: 5–10 bottles</p>
            <Card className="p-4 bg-muted/50">
              <h4 className="font-medium mb-2">💰 Cost Breakdown</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>{data.bottleQuantity} bottles × ${CUSTOMER_PRICING.BOTTLE_PURCHASE_PRICE}</span><span>${data.bottleQuantity * CUSTOMER_PRICING.BOTTLE_PURCHASE_PRICE}</span></div>
                <div className="flex justify-between"><span>Deposit × ${CUSTOMER_PRICING.BOTTLE_DEPOSIT}</span><span>${data.bottleQuantity * CUSTOMER_PRICING.BOTTLE_DEPOSIT}</span></div>
                <div className="flex justify-between font-semibold pt-2 border-t"><span>Total</span><span>${calculateTotal()}</span></div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">ℹ️ Deposit is refundable when you return bottles in good condition</p>
            </Card>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={prevStep}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button className="flex-1 h-12" variant="ocean" onClick={nextStep}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </div>
        );

      // ── Payment ────────────────────────────────────────────────────────────
      case 'payment': {
        const paymentOptions = [
          { value: 'WALLET' as const, label: 'Wallet', icon: Wallet, desc: 'Top-up balance' },
          { value: 'CASH' as const, label: 'Cash on Delivery', icon: Banknote, desc: 'Pay when driver arrives' },
          { value: 'CREDIT_ACCOUNT' as const, label: 'Credit Account', icon: CreditCard, desc: 'Pay later' },
        ];
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Payment Setup</h2>
              <p className="text-sm text-muted-foreground">Choose your preferred payment method</p>
            </div>
            <div className="space-y-3">
              {paymentOptions.map((option) => (
                <Card
                  key={option.value}
                  className={cn('p-4 cursor-pointer transition-all border-2', data.paymentMethod === option.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}
                  onClick={() => updateData({ paymentMethod: option.value })}
                >
                  <div className="flex items-center gap-3">
                    <option.icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </div>
                    {data.paymentMethod === option.value && <Check className="h-5 w-5 text-primary" />}
                  </div>
                </Card>
              ))}
            </div>
            {data.paymentMethod === 'WALLET' && (
              <div className="space-y-2">
                <Label>Add initial wallet balance (optional)</Label>
                <div className="flex gap-2">
                  {[0, 20, 50, 100].map((amount) => (
                    <Button key={amount} variant={data.initialWalletBalance === amount ? 'default' : 'outline'} size="sm" onClick={() => updateData({ initialWalletBalance: amount })}>
                      ${amount}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={prevStep}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
              <Button className="flex-1 h-12" variant="ocean" onClick={nextStep}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </div>
        );
      }

      // ── Confirm ────────────────────────────────────────────────────────────
      case 'confirm':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold">Review & Confirm</h2>
            </div>
            <Card className="p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Account</p>
                <p className="font-medium">{data.fullName}</p>
                <p className="text-sm text-muted-foreground">{data.phoneNumber}</p>
                <p className="text-sm text-muted-foreground">{data.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm">{data.address}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="font-medium">
                  {data.customerType === CustomerType.REFILL_CUSTOMER ? '🔄 Refill Plan' : '📦 One-Time'}
                </p>
                {data.customerType === CustomerType.REFILL_CUSTOMER && (
                  <p className="text-sm text-muted-foreground">{data.bottleQuantity} bottles • Total: ${calculateTotal()}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Payment</p>
                <p className="text-sm">{data.paymentMethod === 'WALLET' ? 'Wallet' : data.paymentMethod === 'CASH' ? 'Cash on Delivery' : 'Credit Account'}</p>
              </div>
            </Card>
            <div className="flex items-start gap-2">
              <Checkbox id="terms" checked={data.termsAccepted} onCheckedChange={(checked) => updateData({ termsAccepted: checked as boolean })} />
              <Label htmlFor="terms" className="text-sm leading-tight">
                I agree to the Terms & Conditions and understand the deposit policy
              </Label>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12" onClick={prevStep} disabled={isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button className="flex-1 h-12" variant="ocean" onClick={handleCompleteRegistration} disabled={isLoading || !data.termsAccepted}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
              </Button>
            </div>
          </div>
        );
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

      {/* Progress bar */}
      <div className="px-4 mb-4">
        <div className="flex gap-1">
          {steps.map((s, i) => (
            <div key={s} className={cn('h-1 flex-1 rounded-full transition-colors', i <= currentStepIndex ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Step {currentStepIndex + 1} of {steps.length}
        </p>
      </div>

      <div className="flex-1 flex items-start justify-center p-4">
        <Card className="w-full max-w-md p-6">
          {renderStep()}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to={CUSTOMER_ROUTES.LOGIN} className="text-primary hover:underline font-medium">
                Login here
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CustomerRegisterPage;