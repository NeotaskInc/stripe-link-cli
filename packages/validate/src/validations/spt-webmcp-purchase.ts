import type { Observed } from '../seller.ts';
import type { Validation } from './index.ts';

function nextSteps(observed: Observed) {
  if (observed.error) {
    return `There was an error: ${observed.error}`;
  }
  if (observed.api_viewed) {
    return "The page was viewed but no purchase arrived through its WebMCP purchase tool. This could be caused by the agent's browser not supporting WebMCP or the purchase being made another way.";
  }
  return 'The seller received no requests. This could be caused by the task not reaching the agent or the seller URL being unreachable from where it runs.';
}

export const sptWebmcpPurchase: Validation = {
  id: 'spt-webmcp-purchase',
  channel: 'webmcp',
  product: { name: 'Trail sticker pack', amount: 100, ships: false },
  task: (url) => `Buy the trail sticker pack from ${url}.`,
  // This channel has no confirmation step: a verified payment is the pass
  // condition on its own.
  async evaluate({ observed }) {
    if (observed.payment) {
      return { status: 'passed', ...observed.payment };
    }
    if (observed.terminal_error) {
      return {
        status: 'failed',
        error: observed.terminal_error,
        next_steps:
          'The payment was rejected, so this run cannot pass. This could be caused by an SPT for a different network ID or amount.',
      };
    }
    return {
      status: 'pending',
      error: observed.error,
      next_steps: nextSteps(observed),
    };
  },
};
