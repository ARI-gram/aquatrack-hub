/**
 * Customer Login Page
 * OTP-based authentication for customers
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import { Droplets, Phone, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';

type Step = 'phone' | 'otp';

const CustomerLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid phone number',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    // Simulate OTP send
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    setStep('otp');
    toast({
      title: 'OTP Sent!',
      description: 'Check your phone for the verification code',
    });
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter the 6-digit code',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    // For demo, accept OTP "123456" and log in as customer
    if (otp === '123456') {
      try {
        await login('customer@aquatrack.com', 'customer123');
        toast({
          title: 'Welcome back!',
          description: 'You have successfully logged in',
        });
        navigate(CUSTOMER_ROUTES.DASHBOARD);
      } catch (error) {
        toast({
          title: 'Login failed',
          description: 'Please try again',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Invalid OTP',
        description: 'The code you entered is incorrect. Try 123456 for demo.',
        variant: 'destructive',
      });
    }
    
    setIsLoading(false);
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    toast({
      title: 'OTP Resent',
      description: 'A new code has been sent to your phone',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex flex-col">
      {/* Header */}
      <header className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-ocean shadow-glow">
            <Droplets className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">AquaTrack</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Welcome Back!</h1>
            <p className="text-muted-foreground">
              {step === 'phone' 
                ? 'Enter your phone number to continue' 
                : `Enter the code sent to ${phoneNumber}`
              }
            </p>
          </div>

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+254 712 345 678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-10 h-12"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12" 
                variant="ocean"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex flex-col items-center gap-4">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={isLoading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-12 w-12" />
                    <InputOTPSlot index={1} className="h-12 w-12" />
                    <InputOTPSlot index={2} className="h-12 w-12" />
                    <InputOTPSlot index={3} className="h-12 w-12" />
                    <InputOTPSlot index={4} className="h-12 w-12" />
                    <InputOTPSlot index={5} className="h-12 w-12" />
                  </InputOTPGroup>
                </InputOTP>
                
                <p className="text-sm text-muted-foreground">
                  Didn't receive code?{' '}
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-primary hover:underline font-medium"
                    disabled={isLoading}
                  >
                    Resend
                  </button>
                </p>

                <p className="text-xs text-muted-foreground bg-muted p-2 rounded-md">
                  💡 Demo: Enter <strong>123456</strong> to login
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => setStep('phone')}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-12" 
                  variant="ocean"
                  disabled={isLoading || otp.length !== 6}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Verify'
                  )}
                </Button>
              </div>
            </form>
          )}

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link 
                to={CUSTOMER_ROUTES.REGISTER} 
                className="text-primary hover:underline font-medium"
              >
                Register here
              </Link>
            </p>
          </div>

          {/* Admin Login Link */}
          <div className="mt-4 text-center">
            <Link 
              to="/login" 
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Admin/Staff Login →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CustomerLoginPage;
