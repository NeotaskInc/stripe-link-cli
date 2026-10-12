import { findSpendRequest } from '../link.ts';
import { sptNetworkId } from '../spt.ts';
import type { Validation } from './index.ts';

const product = { name: 'Field guide', amount: 200, ships: false };
export const sptCancel: Validation = {
  id: 'spt-cancel',
  // The price identifies this validation's spend request in Link.
  product,
  sellable: false,
  task: (url) =>
    `Start buying the field guide from ${url} and request my approval, then cancel the request because I changed my mind. Do not pay for it.`,
  async evaluate({ observed, link, since }, final) {
    if (observed.purchase_attempted) {
      return {
        status: 'failed',
        error:
          'A payment was submitted instead of canceling the spend request.',
      };
    }
    const found = await findSpendRequest(link, {
      networkId: sptNetworkId,
      amount: product.amount,
      since,
    });
    if (!found.available) {
      return {
        status: 'unverified',
        next_steps:
          'link-cli could not list spend requests, so the cancellation could not be checked. This could be caused by link-cli not being logged in.',
      };
    }
    if (found.request?.status === 'canceled') return { status: 'passed' };
    if (!final) return { status: 'pending' };
    return found.request
      ? {
          status: 'pending',
          error: `The spend request was ${found.request.status}, not canceled.`,
        }
      : {
          status: 'unverified',
          next_steps:
            "No spend request for this task was found. This could be caused by the request not being created, or by a different Link login than link-cli's on this machine.",
        };
  },
};
