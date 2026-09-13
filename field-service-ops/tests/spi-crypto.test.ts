import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('spi-crypto', () => {
  it('round-trips encrypt/decrypt', () => {
    process.env.SPI_KEY_ENCRYPTION_SECRET = 'test-secret-for-unit-tests';
    const { encryptSpiKey, decryptSpiKey } = require('../netlify/functions/_lib/spi-crypto.js');
    const plain = 'ds_shop_example_key_value';
    const cipher = encryptSpiKey(plain);
    expect(cipher).not.toContain(plain);
    expect(decryptSpiKey(cipher)).toBe(plain);
  });
});

describe('jobPaymentStatusFromPayments', () => {
  it('maps unpaid/partial/paid', () => {
    const { jobPaymentStatusFromPayments } = require('../netlify/functions/_lib/payments.js');
    expect(jobPaymentStatusFromPayments(1000, [])).toBe('unpaid');
    expect(
      jobPaymentStatusFromPayments(1000, [{ amount_cents: 400, status: 'succeeded' }]),
    ).toBe('partial');
    expect(
      jobPaymentStatusFromPayments(1000, [{ amount_cents: 1000, status: 'succeeded' }]),
    ).toBe('paid');
    expect(
      jobPaymentStatusFromPayments(1000, [{ amount_cents: 1000, status: 'processing' }]),
    ).toBe('processing');
  });
});
