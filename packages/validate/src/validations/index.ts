import type { Channel } from '../channels/index.ts';
import type { LinkCli } from '../link.ts';
import type { Observed } from '../seller.ts';
import { cardBrowserPurchase } from './card-browser-purchase.ts';
import { sptApiCancel } from './spt-api-cancel.ts';
import { sptApiPurchase } from './spt-api-purchase.ts';
import { sptMppPurchase } from './spt-mpp-purchase.ts';
import { sptWebmcpPurchase } from './spt-webmcp-purchase.ts';

export type Verdict = {
  status: 'pending' | 'passed' | 'failed' | 'unverified';
  error?: string;
  next_steps?: string;
  [key: string]: unknown;
};

export type Validation = {
  // URL path segment and result id: <payment method>-<channel>-<scenario>.
  id: string;
  // How the agent reaches the seller.
  channel: Channel;
  product: { name: string; amount: number; ships: boolean };
  // When set, the seller refuses payment with this message instead of charging.
  rejection?: string;
  task: (url: string) => string;
  // Called on every poll until it returns a final status. `final` is set when
  // the run is ending; a still-pending verdict then becomes timed_out.
  evaluate: (
    context: { observed: Observed; link: LinkCli; since: number },
    final: boolean,
  ) => Promise<Verdict>;
};

// Tasks run one at a time in this order. To add a validation, create a module
// in this directory and list it here.
export const validations: Validation[] = [
  sptApiPurchase,
  sptApiCancel,
  sptWebmcpPurchase,
  sptMppPurchase,
  cardBrowserPurchase,
];
