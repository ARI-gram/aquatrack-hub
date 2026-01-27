export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'in_delivery' 
  | 'completed' 
  | 'cancelled' 
  | 'invoiced';

export type PaymentMethod = 'cash' | 'card' | 'wallet' | 'credit';

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'overdue';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  items: OrderItem[];
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  priority: boolean;
  scheduledDate: string;
  scheduledTime?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryInfo {
  orderId: string;
  driverId: string;
  status: 'assigned' | 'en_route' | 'arrived' | 'completed' | 'failed';
  estimatedArrival?: string;
  actualArrival?: string;
  proofOfDelivery?: {
    signature?: string;
    photo?: string;
    notes?: string;
  };
  location?: {
    lat: number;
    lng: number;
  };
}

export const orderStatusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-warning/10 text-warning border-warning/20' },
  confirmed: { label: 'Confirmed', color: 'bg-info/10 text-info border-info/20' },
  in_delivery: { label: 'In Delivery', color: 'bg-accent/10 text-accent border-accent/20' },
  completed: { label: 'Completed', color: 'bg-success/10 text-success border-success/20' },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  invoiced: { label: 'Invoiced', color: 'bg-primary/10 text-primary border-primary/20' },
};

export const paymentStatusConfig: Record<PaymentStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-warning/10 text-warning' },
  paid: { label: 'Paid', color: 'bg-success/10 text-success' },
  partial: { label: 'Partial', color: 'bg-info/10 text-info' },
  overdue: { label: 'Overdue', color: 'bg-destructive/10 text-destructive' },
};
