import type { Schedule, UpcomingSale } from './types';
import { DEFAULT_SCHEDULE, SCHEDULE, VERIFIED_OVERRIDES, VERIFIED_GLOBAL } from '../data/schedules';

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function daysUntil(iso: string): number {
  const d = new Date(`${iso}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export const fmtShort = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const fmtFull = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

export const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const verifiedFor = (countyName: string): string =>
  VERIFIED_OVERRIDES[countyName] ?? VERIFIED_GLOBAL;

export const scheduleFor = (countyName: string): Schedule =>
  SCHEDULE[countyName] ?? DEFAULT_SCHEDULE;

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDINAL = ['', '1st', '2nd', '3rd', '4th', '5th'];

export function scheduleSummary(s: Schedule): string {
  const day = WEEKDAY_NAMES[s.weekday];
  const weeks = s.weeks.length === 4 || s.weeks.length === 5
    ? 'every'
    : s.weeks.map((w) => ORDINAL[w]).join(' and ');
  return `${weeks === 'every' ? 'Every' : weeks} ${day}${weeks === 'every' ? '' : ' of the month'}, ${s.time}`;
}

export function nextSale(name: string, all: Record<string, UpcomingSale[]>): UpcomingSale | null {
  const list = (all[name] ?? []).filter((s) => daysUntil(s.date) >= 0);
  list.sort((a, b) => a.date.localeCompare(b.date));
  return list[0] ?? null;
}

export function allUpcomingFor(name: string, all: Record<string, UpcomingSale[]>): UpcomingSale[] {
  return (all[name] ?? []).filter((s) => daysUntil(s.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));
}
