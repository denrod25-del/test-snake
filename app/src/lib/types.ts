export type AuctionFormat = 'online' | 'in-person';

export interface Link {
  url: string;
  label: string;
}

export interface County {
  name: string;
  region: string;
  major: boolean;
  format: AuctionFormat;
  pa: Link;
  clerk: Link;
  auction: Link;
}

export interface Schedule {
  weekday: number;          // 0 = Sunday … 6 = Saturday
  weeks: number[];          // weeks of month, 1-indexed
  time: string;             // free text, e.g. "10:00 AM ET"
  note?: string;
}

export interface UpcomingSale {
  date: string;             // ISO yyyy-mm-dd
  count?: number;
  opening?: string;
}

export interface StatuteSection {
  id: string;
  title: string;
  summary: string;
  why: string;
  href?: string;
  critical?: boolean;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  subscription_plan: string;
  current_period_end: string | null;
}

export interface SurplusRecord {
  id: string;
  county: string;
  sale_date: string;
  parcel_id: string | null;
  property_addr: string | null;
  prior_owner: string | null;
  surplus_amount: number;
  status: 'unclaimed' | 'claim_filed' | 'paid' | 'escheated';
  claim_deadline: string | null;
  source_url: string | null;
}

export type ParcelStatus = 'researching' | 'ready' | 'passed' | 'won' | 'lost';

export interface Parcel {
  id: string;
  countySlug: string;
  parcelId: string;
  address: string;
  owner: string;
  assessed: string;
  opening: string;
  max: string;
  liens: string;
  notes: string;
  status: ParcelStatus;
  created: number;
  updated: number;
}
