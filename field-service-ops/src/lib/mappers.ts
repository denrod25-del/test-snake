import type {
  Customer,
  Invoice,
  InvoiceLine,
  Job,
  JobStatus,
  Payment,
  PaymentStatus,
  PricebookItem,
  RequestStatus,
  ServiceRequest,
  ShopMember,
  Trade,
} from './types';

export function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    address: String(row.address || ''),
  };
}

export function mapMember(row: Record<string, unknown>): ShopMember {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    userId: String(row.user_id),
    email: String(row.email || ''),
    isOwner: !!row.is_owner,
    isCsr: !!row.is_csr,
    isDispatcher: !!row.is_dispatcher,
    isTech: !!row.is_tech,
  };
}

export function mapRequest(row: Record<string, unknown>): ServiceRequest {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    status: row.status as RequestStatus,
    trade: row.trade as Trade,
    description: String(row.description || ''),
    contactName: String(row.contact_name || ''),
    contactPhone: String(row.contact_phone || ''),
    address: String(row.address || ''),
    preferredWindow: String(row.preferred_window || ''),
    createdAt: String(row.created_at || ''),
  };
}

export function mapJob(row: Record<string, unknown>, photoUrls: string[] = []): Job {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    customerId: row.customer_id ? String(row.customer_id) : null,
    trade: row.trade as Trade,
    description: String(row.description || ''),
    address: String(row.address || ''),
    preferredWindow: String(row.preferred_window || ''),
    status: row.status as JobStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    techUserId: row.tech_user_id ? String(row.tech_user_id) : null,
    scheduledDate: row.scheduled_date ? String(row.scheduled_date) : null,
    notes: String(row.notes || ''),
    photoUrls,
    createdAt: String(row.created_at || ''),
  };
}

export function mapPricebook(row: Record<string, unknown>): PricebookItem {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    name: String(row.name || ''),
    trade: row.trade as Trade,
    unitAmountCents: Number(row.unit_amount_cents || 0),
  };
}

export function mapInvoiceLine(row: Record<string, unknown>): InvoiceLine {
  return {
    id: String(row.id),
    description: String(row.description || ''),
    quantity: Number(row.quantity || 1),
    unitAmountCents: Number(row.unit_amount_cents || 0),
  };
}

export function mapInvoice(
  row: Record<string, unknown>,
  lines: InvoiceLine[] = [],
): Invoice {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    jobId: String(row.job_id),
    lines,
    createdAt: String(row.created_at || ''),
  };
}

export function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: String(row.id),
    shopId: String(row.shop_id),
    invoiceId: String(row.invoice_id),
    jobId: String(row.job_id),
    amountCents: Number(row.amount_cents || 0),
    status: row.status as Payment['status'],
    stripePaymentIntentId: row.stripe_payment_intent_id
      ? String(row.stripe_payment_intent_id)
      : null,
    createdAt: String(row.created_at || ''),
  };
}
