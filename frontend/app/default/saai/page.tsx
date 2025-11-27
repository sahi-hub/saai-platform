import SaaiShopperPage from '@/components/saai/SaaiShopperPage';

export const metadata = {
  title: 'SAAI - AI Shopping Assistant',
  description: 'Your personal AI shopping assistant powered by SAAI'
};

/**
 * Default Tenant SAAI Page
 * 
 * Entry point for the SAAI shopping assistant for default tenant.
 * URL: /default/saai (for ui.saai.pro)
 */
export default function DefaultSaaiPage() {
  return <SaaiShopperPage tenant="default" />;
}
