import type { InvoiceLine } from './types';

export function lineTotalCents(line: Pick<InvoiceLine, 'quantity' | 'unitAmountCents'>): number {
  return Math.max(0, Math.round(line.quantity * line.unitAmountCents));
}

export function invoiceTotalCents(lines: Array<Pick<InvoiceLine, 'quantity' | 'unitAmountCents'>>): number {
  return lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
}

export function remainingBalanceCents(
  totalCents: number,
  payments: Array<{ amountCents: number; status: string }>,
): number {
  const applied = payments
    .filter((p) => p.status === 'succeeded' || p.status === 'processing')
    .reduce((sum, p) => sum + p.amountCents, 0);
  return Math.max(0, totalCents - applied);
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
