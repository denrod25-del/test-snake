export type Trade = 'plumbing' | 'hvac' | 'electrical';

export type JobStatus = 'unassigned' | 'scheduled' | 'en_route' | 'on_site' | 'done';

export type PaymentStatus = 'unpaid' | 'partial' | 'processing' | 'paid';

export type RequestStatus = 'pending' | 'confirmed' | 'declined';

export interface Shop {
  id: string;
  name: string;
  slug: string;
  stripeConnectAccountId: string | null;
  hasSpiKey: boolean;
  createdAt: string;
}

export interface ShopMember {
  id: string;
  shopId: string;
  userId: string;
  email: string;
  isOwner: boolean;
  isCsr: boolean;
  isDispatcher: boolean;
  isTech: boolean;
}

export interface Customer {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface ServiceRequest {
  id: string;
  shopId: string;
  status: RequestStatus;
  trade: Trade;
  description: string;
  contactName: string;
  contactPhone: string;
  address: string;
  preferredWindow: string;
  createdAt: string;
}

export interface Job {
  id: string;
  shopId: string;
  customerId: string | null;
  trade: Trade;
  description: string;
  address: string;
  preferredWindow: string;
  status: JobStatus;
  paymentStatus: PaymentStatus;
  techUserId: string | null;
  scheduledDate: string | null;
  notes: string;
  photoUrls: string[];
  createdAt: string;
}

export interface PricebookItem {
  id: string;
  shopId: string;
  name: string;
  trade: Trade;
  unitAmountCents: number;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
}

export interface Invoice {
  id: string;
  shopId: string;
  jobId: string;
  lines: InvoiceLine[];
  createdAt: string;
}

export interface Payment {
  id: string;
  shopId: string;
  invoiceId: string;
  jobId: string;
  amountCents: number;
  status: 'pending' | 'processing' | 'succeeded' | 'failed';
  stripePaymentIntentId: string | null;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  email: string;
}
