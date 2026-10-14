import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { createClaimsChallenge } from '@/challenge';
import { clearJwksCache, verifyClaimsPresentation } from '@/claims';
import { LinkIssuer } from '@/issuer';
import { CredentialFixture, combineFetch, LinkFixture } from '@/testing/index';

const AUD = 'https://merchant.example';
const EMAIL_TIME = Date.UTC(2026, 8, 30) / 1000;
const PHONE_TIME = Date.UTC(2026, 7, 14) / 1000;

const LEGACY_CLAIMS = {
  email: 'a@example.com',
  email_verified: true,
  phone_number: '+15555550123',
  phone_number_verified: true,
  given_name: 'Ada',
  family_name: 'Lovelace',
};

async function present(
  claims: Record<string, unknown>,
  disclose: string[] = Object.keys(claims),
) {
  clearJwksCache();
  const link = await LinkFixture.create('https://api.link.com', 1);
  const cred = await CredentialFixture.create({
    issuerUrl: 'https://api.link.com',
    claims,
  });
  const fetchImpl = combineFetch(link.fetchImpl(), cred.fetchImpl());
  const issuer = new LinkIssuer({ fetchImpl, minRefreshSeconds: 0 });
  const challenge = await createClaimsChallenge(issuer, {
    audience: AUD,
    claims: ['email'],
  });
  return verifyClaimsPresentation({
    presentation: await cred.present({
      aud: AUD,
      nonce: challenge.nonce,
      disclose,
    }),
    audience: AUD,
    nonce: challenge.nonce,
    issuer,
    requiredClaims: ['email'],
    fetchImpl,
  });
}

describe('verification times', () => {
  it('exposes both times as dates when the credential discloses them', async () => {
    const result = await present({
      ...LEGACY_CLAIMS,
      email_verified_at: EMAIL_TIME,
      phone_verified_at: PHONE_TIME,
    });
    assert.ok(result.valid);
    assert.deepEqual(result.emailVerifiedAt, new Date('2026-09-30T00:00:00Z'));
    assert.deepEqual(result.phoneVerifiedAt, new Date('2026-08-14T00:00:00Z'));
    assert.equal(result.claims.email_verified_at, EMAIL_TIME);
  });

  it('leaves the result unchanged for a credential issued before the claims existed', async () => {
    const result = await present(LEGACY_CLAIMS);
    assert.ok(result.valid);
    assert.deepEqual(Object.keys(result).sort(), [
      'claims',
      'holderKeyThumbprint',
      'issuer',
      'valid',
      'vct',
    ]);
    assert.deepEqual(result.claims, LEGACY_CLAIMS);
  });

  it('exposes only the time that was issued', async () => {
    const result = await present({
      ...LEGACY_CLAIMS,
      email_verified_at: EMAIL_TIME,
    });
    assert.ok(result.valid);
    assert.deepEqual(result.emailVerifiedAt, new Date('2026-09-30T00:00:00Z'));
    assert.equal(Object.hasOwn(result, 'phoneVerifiedAt'), false);
  });

  it('verifies when the holder withholds the times', async () => {
    const result = await present(
      {
        ...LEGACY_CLAIMS,
        email_verified_at: EMAIL_TIME,
        phone_verified_at: PHONE_TIME,
      },
      ['email', 'email_verified'],
    );
    assert.ok(result.valid);
    assert.deepEqual(result.claims, {
      email: 'a@example.com',
      email_verified: true,
    });
    assert.equal(Object.hasOwn(result, 'emailVerifiedAt'), false);
    assert.equal(Object.hasOwn(result, 'phoneVerifiedAt'), false);
  });

  it.each([
    ['a string', '1790726400'],
    ['a negative number', -1],
    ['a fraction', 1790726400.5],
    ['beyond safe integers', 1e20],
    ['null', null],
    ['a boolean', true],
    ['an object', { time: EMAIL_TIME }],
  ])(
    'keeps a malformed time (%s) in claims and out of the typed field',
    async (_name, value) => {
      const result = await present({
        ...LEGACY_CLAIMS,
        email_verified_at: value,
        phone_verified_at: value,
      });
      assert.ok(result.valid);
      assert.equal(Object.hasOwn(result, 'emailVerifiedAt'), false);
      assert.equal(Object.hasOwn(result, 'phoneVerifiedAt'), false);
      assert.deepEqual(result.claims.email_verified_at, value);
    },
  );
});

describe('advertised claims', () => {
  it('lets a verifier request the time claims alongside the original ones', async () => {
    const link = await LinkFixture.create('https://api.link.com', 1);
    const issuer = new LinkIssuer({ fetchImpl: link.fetchImpl() });
    const challenge = await createClaimsChallenge(issuer, {
      audience: AUD,
      claims: [
        'email',
        'email_verified',
        'email_verified_at',
        'phone_verified_at',
      ],
    });
    assert.deepEqual(challenge.body.claims, [
      'email',
      'email_verified',
      'email_verified_at',
      'phone_verified_at',
    ]);
  });
});
