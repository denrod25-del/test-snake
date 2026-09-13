import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mapCustomer,
  mapInvoice,
  mapInvoiceLine,
  mapJob,
  mapMember,
  mapPayment,
  mapPricebook,
  mapRequest,
} from './mappers';
import type {
  Customer,
  Invoice,
  InvoiceLine,
  Job,
  PricebookItem,
  ServiceRequest,
  ShopMember,
  Trade,
} from './types';

export interface ShopSnapshot {
  customers: Customer[];
  requests: ServiceRequest[];
  jobs: Job[];
  pricebook: PricebookItem[];
  invoices: Invoice[];
  payments: import('./types').Payment[];
  members: ShopMember[];
}

const PHOTO_BUCKET = 'job-photos';

async function signedPhotos(
  client: SupabaseClient,
  shopId: string,
  jobId: string,
): Promise<string[]> {
  const prefix = `${shopId}/${jobId}`;
  const { data: listed } = await client.storage.from(PHOTO_BUCKET).list(prefix, { limit: 20 });
  if (!listed?.length) return [];
  const paths = listed.map((f) => `${prefix}/${f.name}`);
  const { data: signed } = await client.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
  return (signed || []).map((s) => s.signedUrl).filter(Boolean) as string[];
}

export async function loadShopSnapshot(
  client: SupabaseClient,
  shopId: string,
): Promise<ShopSnapshot> {
  const [customersRes, requestsRes, jobsRes, pricebookRes, invoicesRes, paymentsRes, membersRes] =
    await Promise.all([
      client.from('customers').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      client
        .from('service_requests')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false }),
      client.from('jobs').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      client.from('pricebook_items').select('*').eq('shop_id', shopId),
      client.from('invoices').select('*').eq('shop_id', shopId),
      client.from('payments').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }),
      client.from('shop_members').select('*').eq('shop_id', shopId),
    ]);

  const invoiceIds = (invoicesRes.data || []).map((r) => String((r as { id: string }).id));
  const linesRes =
    invoiceIds.length === 0
      ? { data: [] as Record<string, unknown>[], error: null }
      : await client.from('invoice_lines').select('*').in('invoice_id', invoiceIds);

  const err =
    customersRes.error ||
    requestsRes.error ||
    jobsRes.error ||
    pricebookRes.error ||
    invoicesRes.error ||
    linesRes.error ||
    paymentsRes.error ||
    membersRes.error;
  if (err) throw err;

  const linesByInvoice = new Map<string, InvoiceLine[]>();
  for (const row of linesRes.data || []) {
    const line = mapInvoiceLine(row as Record<string, unknown>);
    const invId = String((row as { invoice_id: string }).invoice_id);
    const list = linesByInvoice.get(invId) || [];
    list.push(line);
    linesByInvoice.set(invId, list);
  }

  const invoices = (invoicesRes.data || []).map((row) => {
    const r = row as Record<string, unknown>;
    return mapInvoice(r, linesByInvoice.get(String(r.id)) || []);
  });

  const jobs: Job[] = [];
  for (const row of jobsRes.data || []) {
    const r = row as Record<string, unknown>;
    const photos = await signedPhotos(client, shopId, String(r.id));
    jobs.push(mapJob(r, photos));
  }

  return {
    customers: (customersRes.data || []).map((r) => mapCustomer(r as Record<string, unknown>)),
    requests: (requestsRes.data || []).map((r) => mapRequest(r as Record<string, unknown>)),
    jobs,
    pricebook: (pricebookRes.data || []).map((r) => mapPricebook(r as Record<string, unknown>)),
    invoices,
    payments: (paymentsRes.data || []).map((r) => mapPayment(r as Record<string, unknown>)),
    members: (membersRes.data || []).map((r) => mapMember(r as Record<string, unknown>)),
  };
}

export async function createCustomerLive(
  client: SupabaseClient,
  shopId: string,
  data: Omit<Customer, 'id' | 'shopId'>,
): Promise<Customer> {
  const { data: row, error } = await client
    .from('customers')
    .insert({
      shop_id: shopId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      address: data.address,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapCustomer(row as Record<string, unknown>);
}

export async function createJobLive(
  client: SupabaseClient,
  shopId: string,
  data: {
    customerId: string | null;
    trade: Trade;
    description: string;
    address: string;
    preferredWindow: string;
  },
): Promise<Job> {
  const { data: row, error } = await client
    .from('jobs')
    .insert({
      shop_id: shopId,
      customer_id: data.customerId,
      trade: data.trade,
      description: data.description,
      address: data.address,
      preferred_window: data.preferredWindow,
      status: 'unassigned',
      payment_status: 'unpaid',
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapJob(row as Record<string, unknown>);
}

export async function confirmRequestLive(
  client: SupabaseClient,
  requestId: string,
): Promise<string> {
  const { data, error } = await client.rpc('confirm_service_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return String(data);
}

export async function declineRequestLive(
  client: SupabaseClient,
  shopId: string,
  requestId: string,
): Promise<void> {
  const { error } = await client
    .from('service_requests')
    .update({ status: 'declined' })
    .eq('id', requestId)
    .eq('shop_id', shopId)
    .eq('status', 'pending');
  if (error) throw error;
}

export async function assignJobLive(
  client: SupabaseClient,
  shopId: string,
  jobId: string,
  techUserId: string,
  scheduledDate: string,
): Promise<void> {
  const { error } = await client
    .from('jobs')
    .update({
      tech_user_id: techUserId,
      scheduled_date: scheduledDate,
      status: 'scheduled',
    })
    .eq('id', jobId)
    .eq('shop_id', shopId);
  if (error) throw error;
}

export async function updateJobStatusLive(
  client: SupabaseClient,
  shopId: string,
  jobId: string,
  status: Job['status'],
): Promise<void> {
  const { error } = await client
    .from('jobs')
    .update({ status })
    .eq('id', jobId)
    .eq('shop_id', shopId);
  if (error) throw error;
}

export async function updateJobNotesLive(
  client: SupabaseClient,
  shopId: string,
  jobId: string,
  notes: string,
): Promise<void> {
  const { error } = await client
    .from('jobs')
    .update({ notes })
    .eq('id', jobId)
    .eq('shop_id', shopId);
  if (error) throw error;
}

export async function uploadJobPhotoLive(
  client: SupabaseClient,
  shopId: string,
  jobId: string,
  file: File,
): Promise<void> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const path = `${shopId}/${jobId}/${Date.now()}_${safe}`;
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('Only JPEG/PNG/WebP/GIF photos allowed');
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('Photo must be under 8MB');
  const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
}

export async function upsertPricebookLive(
  client: SupabaseClient,
  shopId: string,
  item: Omit<PricebookItem, 'id' | 'shopId'> & { id?: string },
): Promise<PricebookItem> {
  if (item.id) {
    const { data, error } = await client
      .from('pricebook_items')
      .update({
        name: item.name,
        trade: item.trade,
        unit_amount_cents: item.unitAmountCents,
      })
      .eq('id', item.id)
      .eq('shop_id', shopId)
      .select('*')
      .single();
    if (error) throw error;
    return mapPricebook(data as Record<string, unknown>);
  }
  const { data, error } = await client
    .from('pricebook_items')
    .insert({
      shop_id: shopId,
      name: item.name,
      trade: item.trade,
      unit_amount_cents: item.unitAmountCents,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapPricebook(data as Record<string, unknown>);
}

export async function saveInvoiceLive(
  client: SupabaseClient,
  shopId: string,
  jobId: string,
  lines: InvoiceLine[],
): Promise<Invoice> {
  const { data: existing } = await client
    .from('invoices')
    .select('*')
    .eq('shop_id', shopId)
    .eq('job_id', jobId)
    .maybeSingle();

  let invoiceId: string;
  let createdAt: string;
  if (existing) {
    invoiceId = String(existing.id);
    createdAt = String(existing.created_at);
    await client.from('invoice_lines').delete().eq('invoice_id', invoiceId);
  } else {
    const { data: inv, error } = await client
      .from('invoices')
      .insert({ shop_id: shopId, job_id: jobId })
      .select('*')
      .single();
    if (error) throw error;
    invoiceId = String(inv.id);
    createdAt = String(inv.created_at);
  }

  if (lines.length) {
    const { error: lineErr } = await client.from('invoice_lines').insert(
      lines.map((l) => ({
        invoice_id: invoiceId,
        description: l.description,
        quantity: l.quantity,
        unit_amount_cents: l.unitAmountCents,
      })),
    );
    if (lineErr) throw lineErr;
  }

  const { data: savedLines, error: loadErr } = await client
    .from('invoice_lines')
    .select('*')
    .eq('invoice_id', invoiceId);
  if (loadErr) throw loadErr;

  return {
    id: invoiceId,
    shopId,
    jobId,
    lines: (savedLines || []).map((r) => mapInvoiceLine(r as Record<string, unknown>)),
    createdAt,
  };
}
