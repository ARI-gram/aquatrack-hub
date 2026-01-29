/**
 * Billing Plans Page
 * Role: Super Admin
 * Route: /admin/billing
 * Manages subscription plans and billing
 */

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Check,
  CreditCard,
  DollarSign,
  Package,
  Users,
  Zap,
  Edit,
  Plus,
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  description: string;
  features: string[];
  maxUsers: number;
  maxOrders: number;
  popular?: boolean;
  activeSubscriptions: number;
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    interval: 'month',
    description: 'Perfect for small distributors',
    features: [
      'Up to 5 users',
      '500 orders/month',
      'Basic reporting',
      'Email support',
      'Mobile app access',
    ],
    maxUsers: 5,
    maxOrders: 500,
    activeSubscriptions: 12,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 149,
    interval: 'month',
    description: 'For growing businesses',
    features: [
      'Up to 25 users',
      '5,000 orders/month',
      'Advanced reporting',
      'Priority support',
      'API access',
      'Custom branding',
      'Route optimization',
    ],
    maxUsers: 25,
    maxOrders: 5000,
    popular: true,
    activeSubscriptions: 45,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 399,
    interval: 'month',
    description: 'For large operations',
    features: [
      'Unlimited users',
      'Unlimited orders',
      'Custom reporting',
      'Dedicated support',
      'Full API access',
      'White-label solution',
      'Advanced analytics',
      'Multi-location support',
      'SLA guarantee',
    ],
    maxUsers: -1,
    maxOrders: -1,
    activeSubscriptions: 8,
  },
];

const BillingPlansPage: React.FC = () => {
  const [isYearly, setIsYearly] = useState(false);

  const getPrice = (plan: Plan) => {
    return isYearly ? Math.floor(plan.price * 10) : plan.price;
  };

  return (
    <DashboardLayout title="Billing & Plans" subtitle="Manage subscription plans">
      <Tabs defaultValue="plans" className="space-y-6">
        <TabsList>
          <TabsTrigger value="plans">Subscription Plans</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-6">
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={!isYearly ? 'font-medium' : 'text-muted-foreground'}>
              Monthly
            </span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <span className={isYearly ? 'font-medium' : 'text-muted-foreground'}>
              Yearly
              <Badge variant="success" className="ml-2">
                Save 17%
              </Badge>
            </span>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`p-6 relative ${
                  plan.popular ? 'border-primary ring-2 ring-primary/20' : ''
                }`}
              >
                {plan.popular && (
                  <Badge
                    variant="ocean"
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                  >
                    Most Popular
                  </Badge>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${getPrice(plan)}</span>
                    <span className="text-muted-foreground">
                      /{isYearly ? 'year' : 'month'}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <span>Active subscriptions</span>
                    <span className="font-medium text-foreground">
                      {plan.activeSubscriptions}
                    </span>
                  </div>
                  <Button
                    variant={plan.popular ? 'ocean' : 'outline'}
                    className="w-full"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Plan
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex justify-center">
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Custom Plan
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          {/* Revenue Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">$24,580</p>
                  <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">$294,960</p>
                  <p className="text-sm text-muted-foreground">Annual Revenue</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Users className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">65</p>
                  <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Zap className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">4.2%</p>
                  <p className="text-sm text-muted-foreground">Churn Rate</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Revenue by Plan</h3>
            <div className="space-y-4">
              {plans.map((plan) => (
                <div key={plan.id} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium">{plan.name}</div>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-ocean rounded-full"
                      style={{
                        width: `${
                          (plan.activeSubscriptions * plan.price) / 250
                        }%`,
                      }}
                    />
                  </div>
                  <div className="w-24 text-right text-sm">
                    ${(plan.activeSubscriptions * plan.price).toLocaleString()}/mo
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card className="p-6">
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Invoice management coming soon</p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default BillingPlansPage;
