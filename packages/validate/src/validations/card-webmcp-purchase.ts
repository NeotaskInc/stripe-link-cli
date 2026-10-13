import { cardBrowserPurchase } from './card-browser-purchase.ts';
import type { Validation } from './index.ts';

export const cardWebmcpPurchase: Validation = {
  ...cardBrowserPurchase,
  id: 'card-webmcp-purchase',
  channel: 'webmcp',
};
