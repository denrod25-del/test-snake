import type { JobStatus, PaymentStatus } from './types';

const ORDER: JobStatus[] = ['unassigned', 'scheduled', 'en_route', 'on_site', 'done'];

export function canTransition(from: JobStatus, to: JobStatus, allowOfficeOverride: boolean): boolean {
  if (from === to) return true;
  if (allowOfficeOverride) return true;
  const fi = ORDER.indexOf(from);
  const ti = ORDER.indexOf(to);
  return ti === fi + 1;
}

export function nextStatuses(from: JobStatus): JobStatus[] {
  const i = ORDER.indexOf(from);
  if (i < 0 || i >= ORDER.length - 1) return [];
  return [ORDER[i + 1]];
}

export function isFullyPaid(paymentStatus: PaymentStatus): boolean {
  return paymentStatus === 'paid';
}
