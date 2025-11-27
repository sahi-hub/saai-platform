import SaaiShopperPage from '@/components/saai/SaaiShopperPage';

export const metadata = {
  title: 'SAAI - AI Shopping Assistant',
  description: 'Your personal AI shopping assistant powered by SAAI'
};

/**
 * Client1 SAAI Page
 * 
 * Entry point for the SAAI shopping assistant for client1 tenant.
 * URL: /client1/saai
 */
export default function Client1SaaiPage() {
  return <SaaiShopperPage tenant="client1" />;
}
