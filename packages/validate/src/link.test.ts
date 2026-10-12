import { expect, it } from 'vitest';
import {
  defaultShippingAddress,
  findSpendRequest,
  type LinkCli,
  sameAddress,
} from './link.ts';

it('picks the default shipping address, or the only one if none is marked default', async () => {
  const withDefault: LinkCli = async () => [
    { is_default: false, address: { line_1: 'A' } },
    { is_default: true, address: { line_1: 'B' } },
  ];
  expect(await defaultShippingAddress(withDefault)).toEqual({
    address: { line_1: 'B' },
  });

  const single: LinkCli = async () => [{ address: { line_1: 'C' } }];
  expect(await defaultShippingAddress(single)).toEqual({
    address: { line_1: 'C' },
  });
});

it('skips shipping when the address is ambiguous or link-cli output is unreadable', async () => {
  const ambiguous: LinkCli = async () => [
    { address: { line_1: 'A' } },
    { address: { line_1: 'B' } },
  ];
  expect(await defaultShippingAddress(ambiguous)).toHaveProperty('skipped');

  const notArray: LinkCli = async () => undefined;
  expect(await defaultShippingAddress(notArray)).toHaveProperty('skipped');
});

it('compares addresses ignoring case and surrounding whitespace', () => {
  expect(
    sameAddress(
      { line_1: ' 123 Main St ', country_code: 'us' },
      { line_1: '123 Main St', country_code: 'US' },
    ),
  ).toBe(true);
  expect(sameAddress({ line_1: 'A' }, { line_1: 'B' })).toBe(false);
});

it('reports unavailable when link-cli output is not an array', async () => {
  const cli: LinkCli = async () => undefined;
  expect(
    await findSpendRequest(cli, { networkId: 'n', amount: 1, since: 0 }),
  ).toEqual({ available: false });
});

it('finds the newest matching spend request', async () => {
  const now = new Date().toISOString();
  const older = new Date(Date.now() - 1000).toISOString();
  const cli: LinkCli = async () => [
    { network_id: 'other', amount: 200, created_at: now, status: 'created' },
    { network_id: 'n', amount: 200, created_at: older, status: 'created' },
    { network_id: 'n', amount: 200, created_at: now, status: 'canceled' },
  ];
  const found = await findSpendRequest(cli, {
    networkId: 'n',
    amount: 200,
    since: Date.now() - 60_000,
  });
  expect(found).toEqual({
    available: true,
    request: {
      network_id: 'n',
      amount: 200,
      created_at: now,
      status: 'canceled',
    },
  });
});
