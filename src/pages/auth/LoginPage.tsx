// src/pages/auth/LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { roleDefaultRoutes } from '@/constants/routes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Droplets, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function getLoginErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data;

    if (data) {
      if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
        return data.non_field_errors[0] as string;
      }
      if (typeof data.detail === 'string') {
        return data.detail;
      }
      const fieldMessages = Object.values(data)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .filter((v): v is string => typeof v === 'string');
      if (fieldMessages.length > 0) {
        return fieldMessages[0];
      }
    }

    if (error.response?.statusText) {
      return error.response.statusText;
    }

    return 'Unable to reach the server. Please check your connection.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

export const LoginPage: React.FC = () => {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);

  const { login }  = useAuth();
  const navigate   = useNavigate();
  const { toast }  = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login({ email, password });

      const storedUser = localStorage.getItem('aquatrack_user');
      if (storedUser) {
        const user = JSON.parse(storedUser) as { role: keyof typeof roleDefaultRoutes };
        navigate(roleDefaultRoutes[user.role]);
      }
    } catch (error: unknown) {
      toast({
        title:       'Login Failed',
        description: getLoginErrorMessage(error),
        variant:     'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left side — Branding ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-ocean relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-0 w-[200%] h-48 bg-white/10 rounded-full animate-water-wave" />
          <div className="absolute top-1/2 left-0 w-[200%] h-32 bg-white/10 rounded-full animate-water-wave" style={{ animationDelay: '2s' }} />
          <div className="absolute top-3/4 left-0 w-[200%] h-24 bg-white/5  rounded-full animate-water-wave" style={{ animationDelay: '4s' }} />
        </div>

        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm shadow-glow">
              <Droplets className="h-12 w-12" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">AquaTrack</h1>
              <p className="text-white/80">Water Distribution Management</p>
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <h2 className="text-3xl font-semibold leading-tight">
              Streamline your water distribution operations
            </h2>
            <p className="text-lg text-white/80">
              Manage orders, track deliveries, and grow your business with our
              comprehensive SaaS platform designed for water distributors.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                <div className="text-3xl font-bold">500+</div>
                <div className="text-sm text-white/70">Active Distributors</div>
              </div>
              <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm">
                <div className="text-3xl font-bold">10M+</div>
                <div className="text-sm text-white/70">Deliveries Tracked</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right side — Login form ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-surface">
        <div className="w-full max-w-md space-y-8">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="p-3 rounded-xl bg-gradient-ocean shadow-glow">
              <Droplets className="h-8 w-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-foreground">AquaTrack</span>
          </div>

          <Card className="border-0 shadow-lg">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
              <CardDescription>
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword
                        ? <EyeOff className="h-4 w-4" />
                        : <Eye    className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-input" />
                    <span className="text-muted-foreground">Remember me</span>
                  </label>

                  {/* ── Forgot password → dedicated page ── */}
                  <Link
                    to="/forgot-password"
                    className="text-primary hover:underline font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  variant="ocean"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Signing in...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Sign in <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>

              </form>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
};