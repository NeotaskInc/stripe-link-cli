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
        error: 'The buyer tried to pay instead of canceling.',
        next_steps:
          'Have the buyer cancel the spend request after surfacing the approval URL, without paying.',
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
          'link-cli could not list spend requests. Log in with `link-cli auth login` so the validator can check the cancel.',
      };
    }
    if (found.request?.status === 'canceled') return { status: 'passed' };
    if (!final) return { status: 'pending' };
    return found.request
      ? {
          status: 'pending',
          error: `The spend request is ${found.request.status}, not canceled.`,
          next_steps:
            'Have the buyer cancel the spend request after surfacing the approval URL.',
        }
      : {
          status: 'unverified',
          next_steps:
            'No matching spend request was found for this machine’s Link login. Run this task after the previous one, and make sure the buyer uses the same Link login as link-cli.',
        };
  },
};
