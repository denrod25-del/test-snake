import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildPaymentIntentParams,
  assertWebhookBinding,
  mapPaymentStatus,
} = require('../netlify/functions/_lib/payments.js');

describe('payments helpers', () => {
  it('requires connect account', () => {
    expect(() =>
      buildPaymentIntentParams({
        amountCents: 1000,
        shopId: 's',
        invoiceId: 'i',
        jobId: 'j',
        connectAccountId: null,
      }),
    ).toThrow(/Connect/);
  });

  it('builds direct charge params with metadata', () => {
    const params = buildPaymentIntentParams({
      amountCents: 5000,
      shopId: 'shop_a',
      invoiceId: 'inv_1',
      jobId: 'job_1',
      connectAccountId: 'acct_123',
    });
    expect(params.stripeAccount).toBe('acct_123');
    expect(params.metadata.shop_id).toBe('shop_a');
  });

  it('rejects mismatched webhook account', () => {
    const result = assertWebhookBinding(
      { account: 'acct_other', data: { object: { metadata: { invoice_id: 'inv_1', shop_id: 'shop_a' } } } },
      { shopConnectAccountId: 'acct_123', invoiceId: 'inv_1', shopId: 'shop_a' },
    );
    expect(result.ok).toBe(false);
  });

  it('maps stripe statuses', () => {
    expect(mapPaymentStatus('succeeded')).toBe('succeeded');
    expect(mapPaymentStatus('processing')).toBe('processing');
  });
});
