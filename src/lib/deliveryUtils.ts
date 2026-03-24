/**
 * src/lib/deliveryUtils.ts
 *
 * Shared helpers for delivery grouping/sorting.
 * Extracted from CompleteDeliveryDialog to satisfy react-refresh/only-export-components.
 */

import type { DriverDelivery } from '@/api/services/delivery.service';

export interface CustomerGroup {
  name:         string;
  initial:      string;
  deliveries:   DriverDelivery[];
  totalBottles: number;
  totalCollect: number;
  earliestSlot: string;
  /** Present on groups built by DeliveryQueuePage */
  allDone?:     boolean;
}

export function parseSlot(slot = ''): number {
  const m = slot.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 9999;
  let h = parseInt(m[1]);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + parseInt(m[2]);
}

export function buildGroups(list: DriverDelivery[]): CustomerGroup[] {
  const map = new Map<string, DriverDelivery[]>();
  for (const d of list) {
    const key = d.customer_name.trim().toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }
  return Array.from(map.values()).map(items => {
    const sorted = [...items].sort(
      (a, b) => parseSlot(a.scheduled_time_slot) - parseSlot(b.scheduled_time_slot),
    );
    return {
      name:         sorted[0].customer_name,
      initial:      sorted[0].customer_name.trim()[0]?.toUpperCase() ?? '?',
      deliveries:   sorted,
      totalBottles: sorted.reduce((s, d) => s + (d.bottles_to_deliver ?? 0), 0),
      totalCollect: sorted.reduce((s, d) => s + (d.bottles_to_collect ?? 0), 0),
      earliestSlot: sorted[0].scheduled_time_slot ?? '',
    };
  });
}