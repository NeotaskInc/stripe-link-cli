import type { Observed } from '../seller.ts';
import type { Validation } from './index.ts';

function nextSteps(observed: Observed) {
  if (observed.error) {
    return `There was an error: ${observed.error}`;
  }
  if (observed.api_viewed) {
    return 'The paid resource was requested but never paid for. This could be caused by the client not handling HTTP 402 Payment Required with a Stripe payment method.';
  }
  return 'The seller received no requests. This could be caused by the task not reaching the agent or the seller URL being unreachable from where it runs.';
}

export const sptMppPurchase: Validation = {
  id: 'spt-mpp-purchase',
  channel: 'mpp',
  product: { name: 'Trail conditions report', amount: 100, ships: false },
  task: (url) => `Get the trail conditions report from ${url}.`,
  async evaluate({ observed }) {
    if (observed.terminal_error) {
      return {
        status: 'failed',
        error: observed.terminal_error,
        next_steps:
          'The payment was rejected, so this run cannot pass. This could be caused by an SPT for a different network ID or amount.',
      };
    }
    if (observed.payment) {
      return { status: 'passed', ...observed.payment };
    }
    return {
      status: 'pending',
      error: observed.error,
      next_steps: nextSteps(observed),
    };
  },
};
