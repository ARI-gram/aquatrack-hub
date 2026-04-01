/**
 * Customer Dashboard — Redesigned
 * src/pages/customer/CustomerDashboard.tsx
 *
 * Mobile-first design with hero image, real API data, and rich UI.
 */

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { DeliveryTracker } from '@/components/customer/DeliveryTracker';
import {
  CreditStatusBanner,
  type CreditStatus,
} from '@/components/customer/CreditStatusBanner';
import { CUSTOMER_ROUTES } from '@/constants/customerRoutes';
import {
  type DeliveryTrackingData,
  type CustomerOrderTrackingResponse,
  toDeliveryTrackingData,
} from '@/types/customerOrder.types';
import {
  Package, Plus, Clock, ArrowRight, Lock, Loader2,
  Droplets, Wallet, ShoppingBag, TrendingUp, ChevronRight,
  CheckCircle2, Truck, AlertCircle, Star,
} from 'lucide-react';
import axiosInstance from '@/api/axios.config';
import { CUSTOMER_API_ENDPOINTS } from '@/api/customerEndpoints';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  product: string | null;
  product_name: string;
  product_unit: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

interface OrderResponse {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  subtotal: string;
  delivery_fee: string;
  discount_amount: string;
  total_amount: string;
  payment_status: string;
  payment_method: string;
  paid_at: string | null;
  special_instructions: string;
  items: OrderItem[];
  delivery: {
    scheduled_date: string;
    scheduled_time_slot: string;
    address_label: string;
    full_address: string;
    driver_name: string | null;
    driver_phone: string | null;
    actual_delivery_time: string | null;
    delivery_notes: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface WalletData {
  balance: number;
  currency: string;
}

interface BottleData {
  fullBottles: number;
  emptyBottles: number;
  totalOwned: number;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; pill: string; dot: string; accent: string }> = {
  PENDING:    { label: 'Pending',    pill: 'bg-amber-50/80  text-amber-700  border-amber-200',   dot: 'bg-amber-400',   accent: '#f59e0b' },
  CONFIRMED:  { label: 'Confirmed',  pill: 'bg-blue-50/80   text-blue-700   border-blue-200',    dot: 'bg-blue-500',    accent: '#3b82f6' },
  ASSIGNED:   { label: 'Assigned',   pill: 'bg-indigo-50/80 text-indigo-700 border-indigo-200',  dot: 'bg-indigo-500',  accent: '#6366f1' },
  PICKED_UP:  { label: 'Picked Up',  pill: 'bg-cyan-50/80   text-cyan-700   border-cyan-200',    dot: 'bg-cyan-500',    accent: '#06b6d4' },
  IN_TRANSIT: { label: 'In Transit', pill: 'bg-violet-50/80 text-violet-700 border-violet-200',  dot: 'bg-violet-500',  accent: '#8b5cf6' },
  ARRIVED:    { label: 'Arrived',    pill: 'bg-teal-50/80   text-teal-700   border-teal-200',    dot: 'bg-teal-500',    accent: '#14b8a6' },
  DELIVERED:  { label: 'Delivered',  pill: 'bg-emerald-50/80 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', accent: '#10b981' },
  COMPLETED:  { label: 'Completed',  pill: 'bg-emerald-50/80 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', accent: '#10b981' },
  CANCELLED:  { label: 'Cancelled',  pill: 'bg-red-50/80    text-red-700    border-red-200',     dot: 'bg-red-400',     accent: '#ef4444' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchActiveOrderId(): Promise<string | null> {
  try {
    const res = await axiosInstance.get(CUSTOMER_API_ENDPOINTS.ORDERS.LIST);
    const orders: Array<{ id: string; status: string }> = res.data?.results ?? res.data ?? [];
    const active = orders.find(o =>
      ['ASSIGNED', 'IN_TRANSIT', 'NEAR_YOU', 'ARRIVED'].includes(o.status)
    );
    return active?.id ?? null;
  } catch {
    return null;
  }
}

async function fetchTrackingData(orderId: string): Promise<DeliveryTrackingData | null> {
  try {
    const res = await axiosInstance.get<CustomerOrderTrackingResponse>(
      CUSTOMER_API_ENDPOINTS.ORDERS.TRACK(orderId)
    );
    return toDeliveryTrackingData(res.data);
  } catch {
    return null;
  }
}

function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  const first = name?.split(' ')[0] ?? 'there';
  if (hour < 12) return `Good morning, ${first} 👋`;
  if (hour < 17) return `Good afternoon, ${first} 👋`;
  return `Good evening, ${first} 👋`;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  onClick?: () => void;
}> = ({ icon, label, value, sub, color, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100/50 text-left w-full transition-all duration-200 active:scale-[0.97] hover:shadow-md hover:border-slate-200"
  >
    <div className="flex items-center justify-between">
      <div
        className="h-9 w-9 rounded-xl flex items-center justify-center"
        style={{ background: `${color}18` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
    </div>
    <div>
      <p className="text-2xl font-bold text-slate-800 leading-none tabular-nums">{value}</p>
      <p className="text-xs font-medium text-slate-400 mt-1 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </button>
);

// ── Order Row ─────────────────────────────────────────────────────────────────

const OrderRow: React.FC<{ order: OrderResponse; onClick: () => void }> = ({ order, onClick }) => {
  const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.PENDING;
  const total = parseFloat(order.total_amount);
  const items = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3.5 border-b border-slate-50 last:border-0 text-left group"
    >
      {/* Status dot */}
      <div
        className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${cfg.accent}15` }}
      >
        <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-slate-800 font-mono">{order.order_number}</p>
        </div>
        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {new Date(order.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
          {' · '}{items} item{items !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p className="font-bold text-sm text-slate-800 tabular-nums">
          KES {total.toLocaleString()}
        </p>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.pill}`}>
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>
    </button>
  );
};

// ── Bottle Visualizer ─────────────────────────────────────────────────────────

const BottleVisualizer: React.FC<{ full: number; empty: number; total: number }> = ({
  full, empty, total,
}) => {
  const fullPct   = total > 0 ? (full / total) * 100 : 0;
  const emptyPct  = total > 0 ? (empty / total) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 gap-0.5">
        <div
          className="h-full rounded-full bg-sky-400 transition-all duration-700"
          style={{ width: `${fullPct}%` }}
        />
        <div
          className="h-full rounded-full bg-slate-300 transition-all duration-700"
          style={{ width: `${emptyPct}%` }}
        />
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          {full} full
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          {empty} empty
        </span>
        <span className="ml-auto font-semibold text-slate-600">{total} total</span>
      </div>
    </div>
  );
};

// ── Quick Action Button ───────────────────────────────────────────────────────

const QuickAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, color, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
    style={{ background: `${color}12` }}
  >
    <div
      className="h-11 w-11 rounded-xl flex items-center justify-center"
      style={{ background: color, boxShadow: `0 4px 14px ${color}40` }}
    >
      <div className="text-white">{icon}</div>
    </div>
    <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight">{label}</span>
  </button>
);

// ── Main Component ────────────────────────────────────────────────────────────

const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State
  const [creditStatus,    setCreditStatus]    = useState<CreditStatus | null>(null);
  const [activeDelivery,  setActiveDelivery]  = useState<DeliveryTrackingData | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(true);
  const [recentOrders,    setRecentOrders]    = useState<OrderResponse[]>([]);
  const [ordersLoading,   setOrdersLoading]   = useState(true);
  const [wallet,          setWallet]          = useState<WalletData | null>(null);
  const [bottles,         setBottles]         = useState<BottleData | null>(null);
  const [mounted,         setMounted]         = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadCreditStatus = async () => {
    try {
      const res = await axiosInstance.get<CreditStatus>(CUSTOMER_API_ENDPOINTS.CREDIT.STATUS);
      setCreditStatus(res.data);
    } catch { setCreditStatus(null); }
  };

  const loadActiveDelivery = async () => {
    setTrackingLoading(true);
    try {
      const orderId = await fetchActiveOrderId();
      if (orderId) {
        const tracking = await fetchTrackingData(orderId);
        setActiveDelivery(tracking);
      } else {
        setActiveDelivery(null);
      }
    } catch { setActiveDelivery(null); }
    finally { setTrackingLoading(false); }
  };

  const loadRecentOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await axiosInstance.get(CUSTOMER_API_ENDPOINTS.ORDERS.LIST);
      const all: OrderResponse[] = res.data?.results ?? res.data ?? [];
      setRecentOrders(all.slice(0, 5));
    } catch { setRecentOrders([]); }
    finally { setOrdersLoading(false); }
  };

  const loadWallet = async () => {
    try {
      // Try the wallet endpoint — adjust if your endpoint differs
      const res = await axiosInstance.get(CUSTOMER_API_ENDPOINTS.WALLET.GET);
      setWallet({
        balance:  parseFloat(res.data.balance ?? res.data.amount ?? '0'),
        currency: res.data.currency ?? 'KES',
      });
    } catch { setWallet(null); }
  };

  const loadBottles = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bottleEndpoint = (CUSTOMER_API_ENDPOINTS as any).BOTTLES?.INVENTORY ?? '/customer/bottles/';
      const res = await axiosInstance.get(bottleEndpoint);
      setBottles({
        fullBottles:  res.data.full_bottles  ?? res.data.fullBottles  ?? 0,
        emptyBottles: res.data.empty_bottles ?? res.data.emptyBottles ?? 0,
        totalOwned:   res.data.total_owned   ?? res.data.totalOwned   ?? 0,
      });
    } catch { setBottles(null); }
  };

  useEffect(() => {
    loadCreditStatus();
    loadActiveDelivery();
    loadRecentOrders();
    loadWallet();
    loadBottles();
    const interval = setInterval(loadActiveDelivery, 30_000);
    return () => clearInterval(interval);
  }, []);

  const isAccountFrozen = creditStatus?.account_frozen === true;
  const totalSpend = recentOrders
    .filter(o => o.payment_status === 'PAID')
    .reduce((s, o) => s + parseFloat(o.total_amount), 0);
  const completedCount = recentOrders.filter(o =>
    ['COMPLETED', 'DELIVERED'].includes(o.status)
  ).length;

  // ── Hero images (alternate) ───────────────────────────────────────────────

  const HERO_IMAGES = [
    'https://media.istockphoto.com/id/636083442/photo/maintaining-good-hydration-also-supports-healthy-weight-loss.jpg?s=612x612&w=0&k=20&c=vbXF2tYYdZJICUJ09A5jnfxWJYbp5aqDrDMiHkUvgPA=',
    'https://static.vecteezy.com/system/resources/thumbnails/073/275/972/small/pouring-fresh-water-from-plastic-bottle-into-clean-surface-photo.jpg',
  ];
  const heroImg = HERO_IMAGES[0];

  return (
    <CustomerLayout title="Home">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');

        .dash-root { font-family: 'Sora', sans-serif; }

        /* Hero parallax feel */
        .dash-hero {
          position: relative;
          width: calc(100% + 2rem);
          margin: -1rem -1rem 0;
          height: 220px;
          overflow: hidden;
        }
        @media (min-width: 640px) { .dash-hero { height: 260px; } }

        .dash-hero-img {
          width: 100%; height: 100%;
          object-fit: cover;
          object-position: center 35%;
          transform: scale(1.06);
          transition: transform 6s ease-out;
        }
        .dash-hero-img.loaded { transform: scale(1); }

        .dash-hero-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(
            170deg,
            rgba(2, 12, 30, 0.75) 0%,
            rgba(2, 32, 70, 0.6) 40%,
            rgba(2, 32, 70, 0.0) 70%,
            rgba(248,250,252,1) 100%
          );
        }

        .dash-hero-content {
          position: absolute;
          top: 0; left: 0; right: 0;
          padding: 20px 20px 0;
        }

        .dash-greeting {
          font-size: 1.05rem; font-weight: 700;
          color: rgba(255,255,255,0.95);
          text-shadow: 0 1px 8px rgba(0,0,0,0.4);
          letter-spacing: -0.02em;
        }
        .dash-subtext {
          font-size: 0.72rem; font-weight: 500;
          color: rgba(255,255,255,0.65);
          margin-top: 3px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }

        /* Water quality badge */
        .dash-quality-badge {
          display: inline-flex; align-items: center; gap: 5px;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 999px;
          padding: 5px 10px 5px 6px;
          margin-top: 10px;
          font-size: 0.68rem; font-weight: 600;
          color: rgba(255,255,255,0.9);
        }
        .dash-quality-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 6px #4ade80;
        }

        /* Card section pulled up over hero */
        .dash-body {
          margin-top: -32px;
          position: relative;
          z-index: 10;
          padding-bottom: 32px;
        }

        /* Stat grid */
        .dash-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }

        /* Section headers */
        .dash-section-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px;
        }
        .dash-section-title {
          font-size: 0.9rem; font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        .dash-section-link {
          font-size: 0.72rem; font-weight: 600;
          color: #0ea5e9;
          display: flex; align-items: center; gap: 3px;
          cursor: pointer;
          background: none; border: none;
          text-decoration: none;
        }

        /* Panel card */
        .dash-panel {
          background: #fff;
          border-radius: 20px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 2px 12px rgba(0,0,0,0.04);
          padding: 16px;
          margin-bottom: 14px;
        }

        /* Quick actions row */
        .dash-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        /* Frozen banner */
        .dash-frozen {
          display: flex; align-items: center; gap: 10px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 14px;
          padding: 12px 14px;
          margin-bottom: 16px;
        }
        .dash-frozen-text {
          font-size: 0.78rem; font-weight: 500; color: #991b1b;
          line-height: 1.4;
        }

        /* Active delivery pulse */
        @keyframes dash-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .dash-live-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #10b981;
          animation: dash-pulse 2s ease-in-out infinite;
          box-shadow: 0 0 6px #10b981;
        }

        /* Empty state */
        .dash-empty {
          display: flex; flex-direction: column; align-items: center;
          padding: 28px 16px;
          text-align: center;
        }
        .dash-empty-icon {
          width: 56px; height: 56px; border-radius: 18px;
          background: #f8fafc; border: 1px solid #e2e8f0;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 12px;
        }
        .dash-empty-text {
          font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 4px;
        }
        .dash-empty-sub {
          font-size: 0.75rem; color: #94a3b8; line-height: 1.5;
        }

        /* Shimmer loading */
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .shimmer {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }

        /* Wallet balance display */
        .dash-wallet-balance {
          font-size: 2rem; font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .dash-wallet-currency {
          font-size: 0.85rem; font-weight: 600; color: #64748b;
          letter-spacing: 0.04em; margin-right: 4px;
          vertical-align: super; font-size: 0.75rem;
        }

        /* Page entrance */
        .dash-fade-up {
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .dash-fade-up.visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      <div className="dash-root -mx-4 -mt-4">

        {/* ── Hero ── */}
        <div className="dash-hero" ref={heroRef}>
          <img
            className={`dash-hero-img${mounted ? ' loaded' : ''}`}
            src={heroImg}
            alt="Fresh water"
          />
          <div className="dash-hero-overlay" />
          <div className="dash-hero-content">
            <p className="dash-greeting">{getGreeting(user ? `${user.firstName} ${user.lastName}`.trim() : undefined)}</p>
            <p className="dash-subtext">Your hydration dashboard</p>
            <div className="dash-quality-badge">
              <span className="dash-quality-dot" />
              Pure · Filtered · Fresh water
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="dash-body px-4">

          {/* Credit status banner */}
          {creditStatus?.credit_enabled && (
            <div className={`mb-3 dash-fade-up${mounted ? ' visible' : ''}`} style={{ transitionDelay: '0.05s' }}>
              <CreditStatusBanner
                creditStatus={creditStatus}
                onRequestSubmitted={loadCreditStatus}
              />
            </div>
          )}

          {/* Frozen account warning */}
          {isAccountFrozen && (
            <div className={`dash-frozen dash-fade-up${mounted ? ' visible' : ''}`} style={{ transitionDelay: '0.08s' }}>
              <Lock className="h-4 w-4 text-red-500 shrink-0" />
              <p className="dash-frozen-text">
                Ordering paused — settle outstanding invoice to resume
              </p>
            </div>
          )}

          {/* ── Quick Actions ── */}
          <div
            className={`dash-actions dash-fade-up${mounted ? ' visible' : ''}`}
            style={{ transitionDelay: '0.1s' }}
          >
            <QuickAction
              icon={<Plus className="h-5 w-5" />}
              label="Place Order"
              color="#0ea5e9"
              onClick={() => navigate(CUSTOMER_ROUTES.PLACE_ORDER)}
              disabled={isAccountFrozen}
            />
            <QuickAction
              icon={<Wallet className="h-5 w-5" />}
              label="Add Funds"
              color="#8b5cf6"
              onClick={() => navigate(CUSTOMER_ROUTES.WALLET)}
            />
            <QuickAction
              icon={<Droplets className="h-5 w-5" />}
              label="My Bottles"
              color="#06b6d4"
              onClick={() => navigate(CUSTOMER_ROUTES.BOTTLES ?? '/customer/bottles')}
            />
            <QuickAction
              icon={<ShoppingBag className="h-5 w-5" />}
              label="Orders"
              color="#10b981"
              onClick={() => navigate(CUSTOMER_ROUTES.ORDER_HISTORY)}
            />
          </div>

          {/* ── Stats Grid ── */}
          <div
            className={`dash-stats dash-fade-up${mounted ? ' visible' : ''}`}
            style={{ transitionDelay: '0.15s' }}
          >
            {/* Wallet balance */}
            <StatCard
              icon={<Wallet className="h-4 w-4" />}
              label="Wallet Balance"
              value={
                wallet !== null
                  ? `KES ${wallet.balance.toLocaleString()}`
                  : '—'
              }
              color="#8b5cf6"
              onClick={() => navigate(CUSTOMER_ROUTES.WALLET)}
            />

            {/* Orders stat */}
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Total Spent"
              value={
                ordersLoading
                  ? '...'
                  : `KES ${totalSpend.toLocaleString()}`
              }
              sub={`${completedCount} delivered`}
              color="#0ea5e9"
              onClick={() => navigate(CUSTOMER_ROUTES.ORDER_HISTORY)}
            />
          </div>

          {/* ── Bottle tracker ── */}
          {bottles !== null && (
            <div
              className={`dash-panel dash-fade-up${mounted ? ' visible' : ''}`}
              style={{ transitionDelay: '0.2s' }}
            >
              <div className="dash-section-header">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-sky-500" />
                  <span className="dash-section-title">Bottle Status</span>
                </div>
                <button
                  className="dash-section-link"
                  onClick={() => navigate(CUSTOMER_ROUTES.BOTTLES ?? '/customer/bottles')}
                >
                  Details <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <BottleVisualizer
                full={bottles.fullBottles}
                empty={bottles.emptyBottles}
                total={bottles.totalOwned}
              />
              {bottles.emptyBottles > 0 && bottles.fullBottles === 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  All bottles empty — order a refill soon
                </div>
              )}
            </div>
          )}

          {/* ── Active Delivery ── */}
          <div
            className={`dash-fade-up${mounted ? ' visible' : ''}`}
            style={{ transitionDelay: '0.25s' }}
          >
            {trackingLoading ? (
              <div className="dash-panel">
                <div className="flex items-center gap-2 mb-3">
                  <div className="dash-live-dot" />
                  <span className="text-sm font-semibold text-slate-500">Checking deliveries…</span>
                </div>
                <div className="h-3 w-3/4 rounded shimmer" />
                <div className="h-3 w-1/2 rounded shimmer mt-2" />
              </div>
            ) : activeDelivery ? (
              <div className="mb-3">
                <div className="dash-section-header mb-2">
                  <div className="flex items-center gap-2">
                    <div className="dash-live-dot" />
                    <span className="dash-section-title">Active Delivery</span>
                  </div>
                </div>
                <DeliveryTracker
                  tracking={activeDelivery}
                  onCallDriver={() => {
                    if (activeDelivery.driver?.phone) {
                      window.open(`tel:${activeDelivery.driver.phone}`);
                    }
                  }}
                  onTrackLive={() => {
                    navigate(`${CUSTOMER_ROUTES.ORDER_HISTORY}/${activeDelivery.orderId}/track`);
                  }}
                />
              </div>
            ) : (
              <div className="dash-panel mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Truck className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-600">No Active Delivery</span>
                </div>
                <p className="text-xs text-slate-400">
                  Your next delivery will appear here once it's on the way.
                </p>
              </div>
            )}
          </div>

          {/* ── Recent Orders ── */}
          <div
            className={`dash-panel dash-fade-up${mounted ? ' visible' : ''}`}
            style={{ transitionDelay: '0.3s' }}
          >
            <div className="dash-section-header">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-slate-500" />
                <span className="dash-section-title">Recent Orders</span>
              </div>
              <button
                className="dash-section-link"
                onClick={() => navigate(CUSTOMER_ROUTES.ORDER_HISTORY)}
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {ordersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="h-8 w-8 rounded-xl shimmer" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/3 rounded shimmer" />
                      <div className="h-2.5 w-1/3 rounded shimmer" />
                    </div>
                    <div className="h-3 w-16 rounded shimmer" />
                  </div>
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty-icon">
                  <Package className="h-6 w-6 text-slate-300" />
                </div>
                <p className="dash-empty-text">No orders yet</p>
                <p className="dash-empty-sub">Place your first order to get started</p>
                <button
                  onClick={() => navigate(CUSTOMER_ROUTES.PLACE_ORDER)}
                  className="mt-4 px-4 py-2 rounded-xl bg-sky-500 text-white text-xs font-bold transition-all active:scale-95"
                  style={{ boxShadow: '0 4px 14px rgba(14,165,233,0.35)' }}
                >
                  Place Order
                </button>
              </div>
            ) : (
              <div>
                {recentOrders.map(order => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onClick={() => navigate(CUSTOMER_ROUTES.ORDER_HISTORY)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Tips / Promotions strip ── */}
          <div
            className={`dash-fade-up${mounted ? ' visible' : ''}`}
            style={{ transitionDelay: '0.35s' }}
          >
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
                boxShadow: '0 4px 20px rgba(14,165,233,0.35)',
              }}
            >
              <img
                src="https://static.vecteezy.com/system/resources/thumbnails/073/275/972/small/pouring-fresh-water-from-plastic-bottle-into-clean-surface-photo.jpg"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
                style={{ objectPosition: 'center' }}
              />
              <div className="relative px-5 py-5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Star className="h-3.5 w-3.5 text-yellow-300 fill-yellow-300" />
                    <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Stay hydrated</span>
                  </div>
                  <p className="text-white font-bold text-base leading-tight">
                    Never run out<br />of fresh water
                  </p>
                  <p className="text-white/70 text-xs mt-1">Schedule regular refills today</p>
                </div>
                <button
                  onClick={() => navigate(CUSTOMER_ROUTES.PLACE_ORDER)}
                  disabled={isAccountFrozen}
                  className="shrink-0 px-4 py-2.5 rounded-xl bg-white text-sky-700 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                >
                  Order Now
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </CustomerLayout>
  );
};

export default CustomerDashboard;