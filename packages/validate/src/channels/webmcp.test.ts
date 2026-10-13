import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { createValidationServer } from '../seller.ts';
import { createSptAdapter } from '../spt.ts';
import { sptWebmcpPurchase } from '../validations/spt-webmcp-purchase.ts';

const paid = {
  id: 'pi_test',
  status: 'succeeded',
  livemode: false,
  amount: 100,
  currency: 'usd',
};
const servers: Server[] = [];

async function start(stripeResponse: unknown) {
  const stripe = vi.fn<typeof fetch>(async () => Response.json(stripeResponse));
  const run = createValidationServer(
    createSptAdapter('sk_test_seller', stripe),
    [sptWebmcpPurchase],
    () => {},
  );
  servers.push(run.server);
  await new Promise<void>((resolve) =>
    run.server.listen(0, '127.0.0.1', resolve),
  );
  const { port } = run.server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  return { ...run, stripe, url, base: `${url}/spt-webmcp-purchase` };
}

const post = (url: string, body: unknown, headers = {}) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

it('serves a store page with a WebMCP purchase tool, and only pays through it', async () => {
  const run = await start(paid);
  const html = await fetch(run.base).then((r) => r.text());
  expect(html).toContain('registerTool');
  expect(html).toContain("name: 'purchase'");
  expect(run.observe('spt-webmcp-purchase').api_viewed).toBe(true);

  const unauthorized = await post(`${run.base}/purchase`, {
    spt: 'spt_test_buyer',
  });
  expect(unauthorized.status).toBe(400);
  expect(run.stripe).not.toHaveBeenCalled();

  const receipt = await post(
    `${run.base}/purchase`,
    { spt: 'spt_test_buyer' },
    { 'X-WebMCP-Tool': 'purchase' },
  ).then((r) => r.json());
  expect(receipt).toMatchObject({ payment_intent: paid.id });
  expect(run.stripe).toHaveBeenCalledTimes(1);
  expect(run.observe('spt-webmcp-purchase').payment).toMatchObject({
    payment_intent: paid.id,
  });
});
