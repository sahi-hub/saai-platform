'use client';

import { useMemo } from 'react';
import SaaiShopperPage from '@/components/saai/SaaiShopperPage';
import { getCurrentTenant } from '@/utils/tenant';

/**
 * Root Page - SAAI Shopping Assistant
 * 
 * Automatically detects tenant from subdomain and renders the SAAI UI.
 * 
 * Examples:
 * - client1.saai.pro → tenant="client1"
 * - ui.saai.pro → tenant="default"
 * - localhost:3002 → tenant="example"
 */
export default function Home() {
  // Detect tenant from hostname (computed once on mount)
  const tenant = useMemo(() => {
    if (globalThis.window === undefined) return 'default';
    return getCurrentTenant();
  }, []);

  // Render the new SAAI Shopping Assistant UI
  return <SaaiShopperPage tenant={tenant} />;
}

