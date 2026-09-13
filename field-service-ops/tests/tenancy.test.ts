import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map<string, string>();
(globalThis as { localStorage: Storage }).localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k)! : null),
  setItem: (k, v) => {
    store.set(k, String(v));
  },
  removeItem: (k) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

describe('demo tenancy', () => {
  beforeEach(async () => {
    store.clear();
    const demo = await import('../src/lib/demo-store');
    demo.resetDemo();
  });

  it('AE1: shop B cannot read shop A customers', async () => {
    const demo = await import('../src/lib/demo-store');
    const customersA = demo.customersForShop('shop_a');
    expect(customersA.some((c) => c.name === 'Rivera Residence')).toBe(true);
    expect(() => demo.assertShopAccess('user_owner_b', 'shop_a')).toThrow(/Cross-tenant/);
  });

  it('AE2: public request does not create a job until confirm', async () => {
    const demo = await import('../src/lib/demo-store');
    const before = demo.getState().jobs.length;
    demo.createPublicRequest('dogfood', {
      trade: 'hvac',
      description: 'No cool',
      contactName: 'Pat',
      contactPhone: '555',
      address: '1 Main',
      preferredWindow: 'AM',
    });
    expect(demo.getState().jobs.length).toBe(before);
    const req = demo.getState().requests.find((r) => r.contactName === 'Pat');
    expect(req?.status).toBe('pending');
    const job = demo.confirmRequest('shop_a', 'user_owner_a', req!.id);
    expect(job.status).toBe('unassigned');
  });

  it('rejects forged shop_id on public request', async () => {
    const demo = await import('../src/lib/demo-store');
    expect(() =>
      demo.createPublicRequest(
        'dogfood',
        {
          trade: 'plumbing',
          description: 'Leak',
          contactName: 'X',
          contactPhone: '1',
          address: '2',
          preferredWindow: 'PM',
        },
        'shop_b',
      ),
    ).toThrow(/Forged/);
  });

  it('AE3/AE4 payment and unpaid completion', async () => {
    const demo = await import('../src/lib/demo-store');
    const job = demo.createJob('shop_a', 'user_owner_a', {
      customerId: 'cust_1',
      trade: 'plumbing',
      description: 'Leak',
      address: '123 Palm Ave, West Palm Beach, FL',
      preferredWindow: 'AM',
    });
    demo.assignJob('shop_a', 'user_owner_a', job.id, 'user_tech_a', '2026-09-12');
    demo.updateJobStatus('shop_a', 'user_tech_a', job.id, 'done');
    const inv = demo.saveInvoice('shop_a', 'user_tech_a', job.id, [
      { id: 'l1', description: 'Service call', quantity: 1, unitAmountCents: 8900 },
    ]);
    demo.collectDemoPayment('shop_a', 'user_tech_a', inv.id, 8900, true);
    expect(demo.getState().jobs.find((j) => j.id === job.id)?.paymentStatus).toBe('paid');

    const job2 = demo.createJob('shop_a', 'user_owner_a', {
      customerId: 'cust_1',
      trade: 'hvac',
      description: 'Noise',
      address: '9 Oak',
      preferredWindow: 'PM',
    });
    demo.updateJobStatus('shop_a', 'user_owner_a', job2.id, 'done');
    expect(demo.getState().jobs.find((j) => j.id === job2.id)?.paymentStatus).toBe('unpaid');
  });
});
