import { defaultShippingAddress, sameAddress } from '../link.ts';
import type { Observed } from '../seller.ts';
import type { Validation } from './index.ts';

const fix =
  'Get a fresh test SPT for the network ID and price in the purchase API, wait for approval and the token itself, submit it as documented, and keep the confirmation token.';

function nextSteps(observed: Observed) {
  if (observed.paid) {
    return 'The payment succeeded but the buyer never confirmed it. Have the buyer send the confirmation token from the purchase response to the confirmation endpoint. Do not buy again.';
  }
  if (observed.error) {
    return `Fix the buyer agent using the latest seller error, then start a new run. ${fix}`;
  }
  if (observed.api_viewed) {
    return `The buyer read the purchase API but never bought. It may be waiting for the person to approve the payment; check its transcript and that the person is available, then start a new run. ${fix}`;
  }
  return 'The seller received no purchase API requests. Check that the buyer got the task and can reach the seller URL from where its tools run, then start a new run.';
}

export const sptPurchase: Validation = {
  id: 'spt-purchase',
  product: { name: 'Printed trail map', amount: 100, ships: true },
  sellable: true,
  task: (url) =>
    `Buy the printed trail map from ${url}, ship it to my default address, and confirm your purchase.`,
  async evaluate({ observed, link }) {
    if (observed.terminal_error) {
      return {
        status: 'failed',
        error: observed.terminal_error,
        next_steps: `The payment was rejected, so this run cannot pass. Fix the buyer agent and start a new run. ${fix}`,
      };
    }
    if (!observed.confirmed) {
      return {
        status: 'pending',
        error: observed.error,
        next_steps: nextSteps(observed),
      };
    }
    const shipping = await defaultShippingAddress(link);
    if ('skipped' in shipping) {
      return {
        status: 'passed',
        ...observed.payment,
        shipping: 'skipped',
        shipping_note: shipping.skipped,
      };
    }
    if (
      observed.shipping_address &&
      sameAddress(shipping.address, observed.shipping_address)
    ) {
      return { status: 'passed', ...observed.payment, shipping: 'passed' };
    }
    return {
      status: 'failed',
      ...observed.payment,
      shipping: 'failed',
      error:
        'The buyer shipped to an address that is not the default Link shipping address.',
      next_steps:
        'Have the buyer read the Link shipping addresses and use the default one unless told otherwise, then start a new run.',
    };
  },
};
