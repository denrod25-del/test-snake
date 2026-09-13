import { describe, expect, it } from 'vitest';
import { invoiceTotalCents, remainingBalanceCents } from '../src/lib/invoice';
import { canTransition, nextStatuses } from '../src/lib/job-status';
import { normalizeBriefing, trustLabel } from '../src/lib/briefing';

describe('invoice math', () => {
  it('sums line items', () => {
    expect(
      invoiceTotalCents([
        { quantity: 1, unitAmountCents: 8900 },
        { quantity: 2, unitAmountCents: 1000 },
      ]),
    ).toBe(10900);
  });

  it('computes remaining balance with succeeded payments', () => {
    const remaining = remainingBalanceCents(10000, [
      { amountCents: 4000, status: 'succeeded' },
      { amountCents: 1000, status: 'failed' },
    ]);
    expect(remaining).toBe(6000);
  });
});

describe('job status', () => {
  it('suggests next status', () => {
    expect(nextStatuses('en_route')).toEqual(['on_site']);
  });

  it('allows office override', () => {
    expect(canTransition('unassigned', 'done', true)).toBe(true);
    expect(canTransition('unassigned', 'done', false)).toBe(false);
  });
});

describe('briefing honesty', () => {
  it('strips payload from unavailable groups', () => {
    const normalized = normalizeBriefing({
      groups: {
        parcel: { status: 'live', payload: { yearBuilt: 1980 } },
        permits: { status: 'unavailable', payload: { fake: true }, message: 'none' },
      },
    });
    expect(normalized.groups.parcel?.payload).toEqual({ yearBuilt: 1980 });
    expect(normalized.groups.permits?.payload).toBeUndefined();
    expect(trustLabel('cached')).toBe('Cached');
  });
});

describe('schema public shop lookup', () => {
  it('exposes get_public_shop and not broad anon shops select', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const sql = readFileSync(join(__dirname, '../supabase/schema.sql'), 'utf8');
    expect(sql).toContain('get_public_shop');
    expect(sql).not.toContain('shops_public_slug');
  });
});
