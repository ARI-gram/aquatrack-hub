/**
 * src/hooks/useStockRequestPendingCount.ts
 *
 * Returns the live count of PENDING stock requests.
 * Polls every 60s to keep the tab badge fresh.
 */

import { useState, useEffect } from 'react';
import { stockRequestService } from '@/api/services/stock-request.service';

export function useStockRequestPendingCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      const n = await stockRequestService.getPendingCount();
      if (!cancelled) setCount(n);
    };

    fetch();

    const id = setInterval(fetch, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return count;
}

export default useStockRequestPendingCount;