import type { Address } from '../link.ts';
import { type ChannelContext, readBody } from '../seller.ts';
import { productLine } from './api.ts';

// Fields copied verbatim from the form into the shipping address, beyond the
// required line_1 and country_code handled separately below.
const optionalShippingFields = [
  'name',
  'line_2',
  'locality',
  'administrative_area',
  'postal_code',
] as const;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let doubleDigit = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let value = Number(digits[i]);
    if (doubleDigit) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function expiryInFuture(expiry: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry.trim());
  if (!match) return false;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return false;
  const year = 2000 + Number(match[2]);
  // new Date(year, month, 0) is the last instant of the 1-indexed `month`.
  return new Date(year, month, 0, 23, 59, 59).getTime() >= Date.now();
}

function field(
  id: string,
  label: string,
  autocomplete: string,
  required = true,
) {
  return (
    `<label for="${id}">${label}</label>` +
    `<input id="${id}" name="${id}" autocomplete="${autocomplete}"${required ? ' required' : ''}>`
  );
}

function checkoutPage(context: ChannelContext) {
  return (
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Trail Notes checkout</title>` +
    `<h1>Trail Notes</h1><p>${productLine(context)}</p>` +
    `<form method="post" action="${context.base}/purchase">` +
    field('name', 'Name on card', 'cc-name') +
    field('card_number', 'Card number', 'cc-number') +
    field('expiry', 'Expiry (MM/YY)', 'cc-exp') +
    field('cvc', 'CVC', 'cc-csc') +
    field('line_1', 'Address line 1', 'address-line1') +
    field('line_2', 'Address line 2', 'address-line2', false) +
    field('locality', 'City', 'address-level2') +
    field('administrative_area', 'State', 'address-level1') +
    field('postal_code', 'Postal code', 'postal-code') +
    field('country_code', 'Country code', 'country') +
    `<button type="submit">Place order</button></form></html>`
  );
}

async function purchase(context: ChannelContext) {
  const { request, run, report, fail, send } = context;
  const { observed } = run;
  if (observed.confirmed || observed.payment) {
    context.reply(409, {
      error:
        'This validation already has a purchase. If it failed, start a new validation run.',
    });
    return;
  }

  const params = new URLSearchParams(await readBody(request));
  const cardNumber = (params.get('card_number') ?? '').replace(/\s+/g, '');
  const expiry = params.get('expiry') ?? '';
  const cvc = params.get('cvc') ?? '';
  const line1 = params.get('line_1') ?? '';
  const countryCode = params.get('country_code') ?? '';

  if (!/^\d{13,19}$/.test(cardNumber) || !luhnValid(cardNumber)) {
    fail(400, 'Enter a valid card number.');
    return;
  }
  if (!expiryInFuture(expiry)) {
    fail(400, 'Enter a card expiry (MM/YY) that has not already passed.');
    return;
  }
  if (!/^\d{3,4}$/.test(cvc)) {
    fail(400, 'Enter a valid CVC.');
    return;
  }
  if (!line1 || !/^[A-Za-z]{2}$/.test(countryCode)) {
    fail(
      400,
      'Enter a shipping address with address line 1 and a 2-letter country code.',
    );
    return;
  }

  report({ step: 'purchase_submitted' });
  const shippingAddress: Record<string, string> = {
    line_1: line1,
    country_code: countryCode.toUpperCase(),
  };
  for (const key of optionalShippingFields) {
    const value = params.get(key);
    if (value) shippingAddress[key] = value;
  }

  // Link's test-mode virtual card cannot be charged through Stripe, so this
  // channel accepts any well-formed card details with no Stripe call. The
  // point is to check that the agent can complete a card checkout form.
  observed.payment = { card_last4: cardNumber.slice(-4) };
  observed.shipping_address = shippingAddress as Address;
  observed.confirmed = true;
  observed.error = undefined;
  report({ step: 'confirmed' });
  send(
    200,
    'text/html; charset=utf-8',
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Order placed</title>` +
      `<h1>Order placed</h1><p>Thanks! Your order is confirmed.</p></html>`,
  );
}

// Card checkout form: GET / (checkout page), POST /purchase.
export async function browser(context: ChannelContext) {
  const { request, page, run, report, send } = context;
  if (request.method === 'GET' && page === '/') {
    run.observed.api_viewed = true;
    report({ step: 'api_viewed' });
    send(200, 'text/html; charset=utf-8', checkoutPage(context));
    return;
  }
  if (request.method === 'POST' && page === '/purchase') {
    await purchase(context);
    return;
  }
  context.reply(404, { error: 'Not found' });
}
