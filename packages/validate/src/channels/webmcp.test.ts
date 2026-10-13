import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { createValidationServer } from '../seller.ts';
import { createSptAdapter } from '../spt.ts';
import { cardWebmcpPurchase } from '../validations/card-webmcp-purchase.ts';

const servers: Server[] = [];

async function start() {
  const stripe = vi.fn<typeof fetch>();
  const run = createValidationServer(
    createSptAdapter('sk_test_seller', stripe),
    [cardWebmcpPurchase],
    () => {},
  );
  servers.push(run.server);
  await new Promise<void>((resolve) =>
    run.server.listen(0, '127.0.0.1', resolve),
  );
  const { port } = run.server.address() as AddressInfo;
  return {
    ...run,
    stripe,
    url: `http://127.0.0.1:${port}/card-webmcp-purchase`,
  };
}

const address = {
  line_1: '123 Main St',
  locality: 'Springfield',
  administrative_area: 'IL',
  postal_code: '62701',
  country_code: 'US',
};
const validForm = {
  name: 'Jamie Rivers',
  card_number: '4242 4242 4242 4242',
  expiry: '12/39',
  cvc: '123',
  ...address,
};
const post = (url: string, form: Record<string, string>, headers = {}) =>
  fetch(`${url}/purchase`, {
    method: 'POST',
    headers,
    body: new URLSearchParams(form),
  });

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

it('requires the WebMCP checkout form submission', async () => {
  const run = await start();
  const html = await fetch(run.url).then((r) => r.text());
  expect(html).toContain('cc-number');
  expect(run.observe('card-webmcp-purchase').api_viewed).toBe(true);

  const response = await post(run.url, validForm);
  expect(response.status).toBe(400);
  expect(run.observe('card-webmcp-purchase').confirmed).toBe(false);
  expect(run.stripe).not.toHaveBeenCalled();
});

it('completes card checkout without charging and checks the shipping address', async () => {
  const run = await start();
  const response = await post(run.url, validForm, {
    'X-WebMCP-Tool': 'purchase',
  });
  expect(response.status).toBe(200);
  expect(await response.text()).not.toContain(validForm.card_number);
  const observed = run.observe('card-webmcp-purchase');
  expect(observed).toMatchObject({
    confirmed: true,
    payment: { card_last4: '4242' },
    shipping_address: address,
  });
  expect(JSON.stringify(observed)).not.toContain(validForm.card_number);
  const link = vi.fn(async () => [{ is_default: true, address }]);
  expect(
    await cardWebmcpPurchase.evaluate({ observed, link, since: 0 }, false),
  ).toMatchObject({
    status: 'passed',
    shipping: 'passed',
    card_last4: '4242',
  });
  expect(link).toHaveBeenCalledWith(['shipping-address', 'list']);
  expect(run.stripe).not.toHaveBeenCalled();
});
