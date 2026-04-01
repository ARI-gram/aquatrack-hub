import { useMemo } from 'react';
import { User }    from '@/types/auth.types';

const PASSWORD_EXPIRY_DAYS  = 30;
const EXPIRY_WARNING_DAYS   = 7;

export function usePasswordPolicy(user: User | null) {
  return useMemo(() => {
    const fallback = {
      mustChange: false, isExpired: false,
      daysLeft: null as number | null, showBanner: false,
      reason: 'temporary' as const,
    };

    if (!user) return fallback;

    if (user.must_change_password) {
      return { ...fallback, mustChange: true, reason: 'temporary' as const };
    }

    if (!user.password_changed_at) return fallback;

    const ageDays  = Math.floor((Date.now() - new Date(user.password_changed_at).getTime()) / 86_400_000);
    const daysLeft = Math.max(0, PASSWORD_EXPIRY_DAYS - ageDays);
    const isExpired  = ageDays >= PASSWORD_EXPIRY_DAYS;
    const showBanner = !isExpired && daysLeft <= EXPIRY_WARNING_DAYS;

    return { mustChange: isExpired, isExpired, daysLeft, showBanner, reason: 'expired' as const };
  }, [user]);
}