/**
 * Delivery Detail Page
 * Role: Driver
 * Route: /driver/deliveries/:id
 * View and update delivery details
 */

import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Clock,
  Package,
  Navigation,
  CheckCircle,
  XCircle,
  Camera,
  FileSignature,
} from 'lucide-react';
import { toast } from 'sonner';

const DeliveryDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isUpdating, setIsUpdating] = useState(false);
  const [failureReason, setFailureReason] = useState('');

  // Mock delivery data
  const delivery = {
    id: id || '1',
    orderNumber: 'ORD-2024-001',
    customerName: 'ABC Corporation',
    address: '123 Business Park, Suite 100, Downtown Area',
    phone: '+1 555-0301',
    email: 'contact@abc-corp.com',
    items: [
      { name: '20L Water Bottle', quantity: 3, price: 15.0 },
      { name: '5L Water Bottle', quantity: 2, price: 8.0 },
    ],
    status: 'in_progress' as const,
    scheduledTime: '10:00 AM - 12:00 PM',
    scheduledDate: '2024-11-15',
    notes: 'Use back entrance, ask for John at reception',
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'pending',
    totalAmount: 61.0,
  };

  const handleComplete = async () => {
    setIsUpdating(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsUpdating(false);
    toast.success('Delivery marked as completed');
    navigate('/driver/deliveries');
  };

  const handleFailed = async () => {
    if (!failureReason.trim()) {
      toast.error('Please provide a reason for failed delivery');
      return;
    }
    setIsUpdating(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsUpdating(false);
    toast.success('Delivery marked as failed');
    navigate('/driver/deliveries');
  };

  const getStatusBadge = () => {
    const config = {
      pending: { variant: 'warning' as const, label: 'Pending' },
      in_progress: { variant: 'info' as const, label: 'In Progress' },
      completed: { variant: 'success' as const, label: 'Completed' },
      failed: { variant: 'destructive' as const, label: 'Failed' },
    };
    return (
      <Badge variant={config[delivery.status].variant}>
        {config[delivery.status].label}
      </Badge>
    );
  };

  return (
    <DashboardLayout title="Delivery Details" subtitle={delivery.orderNumber}>
      <Button variant="ghost" className="mb-4" onClick={() => navigate('/driver/deliveries')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Queue
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{delivery.customerName}</h2>
              {getStatusBadge()}
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Delivery Address</p>
                  <p className="text-muted-foreground">{delivery.address}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Contact</p>
                  <p className="text-muted-foreground">{delivery.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Scheduled Time</p>
                  <p className="text-muted-foreground">
                    {delivery.scheduledDate} • {delivery.scheduledTime}
                  </p>
                </div>
              </div>

              {delivery.notes && (
                <div className="p-4 bg-warning/10 rounded-lg border border-warning/20">
                  <p className="font-medium text-warning-foreground">Special Instructions</p>
                  <p className="text-sm">{delivery.notes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1">
                <Phone className="h-4 w-4 mr-2" />
                Call Customer
              </Button>
              <Button variant="outline" className="flex-1">
                <Navigation className="h-4 w-4 mr-2" />
                Get Directions
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Items
            </h3>
            <div className="space-y-3">
              {delivery.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-3 border-b last:border-0"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ${item.price.toFixed(2)} each
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">x{item.quantity}</p>
                    <p className="text-sm text-muted-foreground">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Payment Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span>{delivery.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="warning">{delivery.paymentStatus}</Badge>
              </div>
              <div className="flex justify-between pt-3 border-t">
                <span className="font-medium">Total</span>
                <span className="font-bold text-lg">${delivery.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Complete Delivery</h3>
            <div className="space-y-3">
              <Button variant="outline" className="w-full">
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </Button>
              <Button variant="outline" className="w-full">
                <FileSignature className="h-4 w-4 mr-2" />
                Capture Signature
              </Button>
              <Button
                variant="ocean"
                className="w-full"
                onClick={handleComplete}
                disabled={isUpdating}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {isUpdating ? 'Updating...' : 'Mark as Delivered'}
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <XCircle className="h-4 w-4 mr-2" />
                    Mark as Failed
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Report Failed Delivery</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Reason for failure</Label>
                      <Textarea
                        placeholder="Enter reason..."
                        value={failureReason}
                        onChange={(e) => setFailureReason(e.target.value)}
                        rows={4}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleFailed}
                      disabled={isUpdating}
                    >
                      {isUpdating ? 'Submitting...' : 'Submit Failed Report'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DeliveryDetailPage;
