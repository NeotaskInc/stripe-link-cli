import { defaultShippingAddress, sameAddress } from '../link.ts';
import type { Observed } from '../seller.ts';
import type { Scenario } from './index.ts';

function nextSteps(observed: Observed) {
  if (observed.error) {
    return `There was an error: ${observed.error}`;
  }
  if (observed.api_viewed) {
    return 'The checkout page was viewed but no order was submitted. This could be caused by a card spend request that was never approved or the page not being driven in a browser.';
  }
  return 'The seller received no requests. This could be caused by the task not reaching the agent or the seller URL being unreachable from where it runs.';
}

export const card: Scenario[] = [
  {
    name: 'purchase',
    channels: ['browser', 'webmcp'],
    product: { name: 'Trail water bottle', amount: 100, ships: true },
    task: (url) =>
      `Buy the trail water bottle from ${url} and ship it to my default address.`,
    async evaluate({ observed, link }) {
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
          'The order shipped to an address other than the default Link shipping address.',
      };
    },
  },
];
