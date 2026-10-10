import { describe, expect, it } from 'vitest';
import { mapCustomer, mapJob, mapRequest } from '../src/lib/mappers';

describe('mappers', () => {
  it('maps customer snake_case rows', () => {
    expect(
      mapCustomer({
        id: 'c1',
        shop_id: 's1',
        name: 'Ada',
        phone: '555',
        email: 'a@b.c',
        address: '1 Main',
      }),
    ).toEqual({
      id: 'c1',
      shopId: 's1',
      name: 'Ada',
      phone: '555',
      email: 'a@b.c',
      address: '1 Main',
    });
  });

  it('maps jobs with empty photos by default', () => {
    const job = mapJob({
      id: 'j1',
      shop_id: 's1',
      customer_id: null,
      trade: 'plumbing',
      description: 'leak',
      address: '1 Main',
      preferred_window: 'AM',
      status: 'unassigned',
      payment_status: 'unpaid',
      tech_user_id: null,
      scheduled_date: null,
      notes: '',
      created_at: '2026-01-01',
    });
    expect(job.photoUrls).toEqual([]);
    expect(job.status).toBe('unassigned');
  });

  it('maps public request contacts', () => {
    const req = mapRequest({
      id: 'r1',
      shop_id: 's1',
      status: 'pending',
      trade: 'hvac',
      description: 'AC',
      contact_name: 'Bob',
      contact_phone: '1',
      address: '2 Oak',
      preferred_window: 'ASAP',
      created_at: '2026-01-01',
    });
    expect(req.contactName).toBe('Bob');
    expect(req.trade).toBe('hvac');
  });
});
