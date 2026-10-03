import type {
  Customer,
  Invoice,
  InvoiceLine,
  Job,
  Payment,
  PricebookItem,
  ServiceRequest,
  SessionUser,
  Shop,
  ShopMember,
  Trade,
} from './types';
import { invoiceTotalCents, remainingBalanceCents } from './invoice';

const KEY = 'fso-demo-v1';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export interface DemoState {
  user: SessionUser | null;
  shops: Shop[];
  members: ShopMember[];
  customers: Customer[];
  requests: ServiceRequest[];
  jobs: Job[];
  pricebook: PricebookItem[];
  invoices: Invoice[];
  payments: Payment[];
  activeShopId: string | null;
}

function seed(): DemoState {
  const shopA: Shop = {
    id: 'shop_a',
    name: 'Dogfood Plumbing & Air',
    slug: 'dogfood',
    stripeConnectAccountId: 'acct_demo_a',
    hasSpiKey: true,
    createdAt: new Date().toISOString(),
  };
  const shopB: Shop = {
    id: 'shop_b',
    name: 'Other Coast Electric',
    slug: 'other-coast',
    stripeConnectAccountId: null,
    hasSpiKey: false,
    createdAt: new Date().toISOString(),
  };
  const ownerA: SessionUser = { id: 'user_owner_a', email: 'owner@dogfood.local' };
  const techA: ShopMember = {
    id: 'mem_tech_a',
    shopId: shopA.id,
    userId: 'user_tech_a',
    email: 'tech@dogfood.local',
    isOwner: false,
    isCsr: false,
    isDispatcher: false,
    isTech: true,
  };
  const ownerMember: ShopMember = {
    id: 'mem_owner_a',
    shopId: shopA.id,
    userId: ownerA.id,
    email: ownerA.email,
    isOwner: true,
    isCsr: true,
    isDispatcher: true,
    isTech: true,
  };
  const ownerB: ShopMember = {
    id: 'mem_owner_b',
    shopId: shopB.id,
    userId: 'user_owner_b',
    email: 'owner@other.local',
    isOwner: true,
    isCsr: true,
    isDispatcher: true,
    isTech: false,
  };
  const customer: Customer = {
    id: 'cust_1',
    shopId: shopA.id,
    name: 'Rivera Residence',
    phone: '561-555-0100',
    email: 'rivera@example.com',
    address: '123 Palm Ave, West Palm Beach, FL',
  };
  const pricebook: PricebookItem[] = [
    {
      id: 'pb_1',
      shopId: shopA.id,
      name: 'Service call',
      trade: 'plumbing',
      unitAmountCents: 8900,
    },
    {
      id: 'pb_2',
      shopId: shopA.id,
      name: 'Water heater flush',
      trade: 'plumbing',
      unitAmountCents: 14900,
    },
    {
      id: 'pb_3',
      shopId: shopA.id,
      name: 'AC diagnostic',
      trade: 'hvac',
      unitAmountCents: 12900,
    },
  ];
  return {
    user: ownerA,
    shops: [shopA, shopB],
    members: [ownerMember, techA, ownerB],
    customers: [customer],
    requests: [],
    jobs: [],
    pricebook,
    invoices: [],
    payments: [],
    activeShopId: shopA.id,
  };
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      save(s);
      return s;
    }
    return JSON.parse(raw) as DemoState;
  } catch {
    const s = seed();
    save(s);
    return s;
  }
}

function save(state: DemoState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetDemo(): DemoState {
  const s = seed();
  save(s);
  return s;
}

export function getState(): DemoState {
  return load();
}

export function setUser(user: SessionUser | null): DemoState {
  const s = load();
  s.user = user;
  if (user) {
    const membership = s.members.find((m) => m.userId === user.id);
    s.activeShopId = membership?.shopId ?? s.activeShopId;
  }
  save(s);
  return s;
}

export function createShopWithOwner(name: string, slug: string, email: string): DemoState {
  const s = load();
  const user: SessionUser = { id: uid('user'), email };
  const shop: Shop = {
    id: uid('shop'),
    name,
    slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    stripeConnectAccountId: null,
    hasSpiKey: false,
    createdAt: new Date().toISOString(),
  };
  const member: ShopMember = {
    id: uid('mem'),
    shopId: shop.id,
    userId: user.id,
    email,
    isOwner: true,
    isCsr: true,
    isDispatcher: true,
    isTech: true,
  };
  s.user = user;
  s.shops.push(shop);
  s.members.push(member);
  s.activeShopId = shop.id;
  save(s);
  return s;
}

export function membershipFor(userId: string, shopId: string): ShopMember | undefined {
  return load().members.find((m) => m.userId === userId && m.shopId === shopId);
}

export function shopsVisibleTo(userId: string): Shop[] {
  const s = load();
  const ids = new Set(s.members.filter((m) => m.userId === userId).map((m) => m.shopId));
  return s.shops.filter((shop) => ids.has(shop.id));
}

export function assertShopAccess(userId: string, shopId: string): void {
  if (!membershipFor(userId, shopId)) {
    throw new Error('Cross-tenant access denied');
  }
}

export function customersForShop(shopId: string): Customer[] {
  return load().customers.filter((c) => c.shopId === shopId);
}

export function createCustomer(
  shopId: string,
  userId: string,
  data: Omit<Customer, 'id' | 'shopId'>,
): Customer {
  assertShopAccess(userId, shopId);
  const s = load();
  const customer: Customer = { id: uid('cust'), shopId, ...data };
  s.customers.push(customer);
  save(s);
  return customer;
}

export function createJob(
  shopId: string,
  userId: string,
  data: {
    customerId: string | null;
    trade: Trade;
    description: string;
    address: string;
    preferredWindow: string;
  },
): Job {
  assertShopAccess(userId, shopId);
  const s = load();
  const job: Job = {
    id: uid('job'),
    shopId,
    customerId: data.customerId,
    trade: data.trade,
    description: data.description,
    address: data.address,
    preferredWindow: data.preferredWindow,
    status: 'unassigned',
    paymentStatus: 'unpaid',
    techUserId: null,
    scheduledDate: null,
    notes: '',
    photoUrls: [],
    createdAt: new Date().toISOString(),
  };
  s.jobs.push(job);
  save(s);
  return job;
}

export function createPublicRequest(
  slug: string,
  data: {
    trade: Trade;
    description: string;
    contactName: string;
    contactPhone: string;
    address: string;
    preferredWindow: string;
  },
  clientShopId?: string,
): ServiceRequest {
  const s = load();
  const shop = s.shops.find((x) => x.slug === slug);
  if (!shop) throw new Error('Shop not found');
  if (clientShopId && clientShopId !== shop.id) {
    throw new Error('Forged shop_id rejected');
  }
  const req: ServiceRequest = {
    id: uid('req'),
    shopId: shop.id,
    status: 'pending',
    ...data,
    createdAt: new Date().toISOString(),
  };
  s.requests.push(req);
  save(s);
  return req;
}

export function confirmRequest(shopId: string, userId: string, requestId: string): Job {
  assertShopAccess(userId, shopId);
  const s = load();
  const req = s.requests.find((r) => r.id === requestId && r.shopId === shopId);
  if (!req || req.status !== 'pending') throw new Error('Request not pending');
  req.status = 'confirmed';
  let customer = s.customers.find(
    (c) => c.shopId === shopId && c.phone === req.contactPhone && c.name === req.contactName,
  );
  if (!customer) {
    customer = {
      id: uid('cust'),
      shopId,
      name: req.contactName,
      phone: req.contactPhone,
      email: '',
      address: req.address,
    };
    s.customers.push(customer);
  }
  const job: Job = {
    id: uid('job'),
    shopId,
    customerId: customer.id,
    trade: req.trade,
    description: req.description,
    address: req.address,
    preferredWindow: req.preferredWindow,
    status: 'unassigned',
    paymentStatus: 'unpaid',
    techUserId: null,
    scheduledDate: null,
    notes: '',
    photoUrls: [],
    createdAt: new Date().toISOString(),
  };
  s.jobs.push(job);
  save(s);
  return job;
}

export function declineRequest(shopId: string, userId: string, requestId: string): void {
  assertShopAccess(userId, shopId);
  const s = load();
  const req = s.requests.find((r) => r.id === requestId && r.shopId === shopId);
  if (!req) throw new Error('Request not found');
  req.status = 'declined';
  save(s);
}

export function assignJob(
  shopId: string,
  userId: string,
  jobId: string,
  techUserId: string,
  scheduledDate: string,
): Job {
  assertShopAccess(userId, shopId);
  const s = load();
  const job = s.jobs.find((j) => j.id === jobId && j.shopId === shopId);
  if (!job) throw new Error('Job not found');
  job.techUserId = techUserId;
  job.scheduledDate = scheduledDate;
  job.status = 'scheduled';
  save(s);
  return job;
}

export function updateJobStatus(
  shopId: string,
  userId: string,
  jobId: string,
  status: Job['status'],
): Job {
  assertShopAccess(userId, shopId);
  const s = load();
  const job = s.jobs.find((j) => j.id === jobId && j.shopId === shopId);
  if (!job) throw new Error('Job not found');
  job.status = status;
  save(s);
  return job;
}

export function updateJobNotes(
  shopId: string,
  userId: string,
  jobId: string,
  notes: string,
  photoDataUrl?: string,
): Job {
  assertShopAccess(userId, shopId);
  const s = load();
  const job = s.jobs.find((j) => j.id === jobId && j.shopId === shopId);
  if (!job) throw new Error('Job not found');
  job.notes = notes;
  if (photoDataUrl) job.photoUrls = [...job.photoUrls, photoDataUrl].slice(-8);
  save(s);
  return job;
}

export function upsertPricebookItem(
  shopId: string,
  userId: string,
  item: Omit<PricebookItem, 'id' | 'shopId'> & { id?: string },
): PricebookItem {
  assertShopAccess(userId, shopId);
  const s = load();
  if (item.id) {
    const existing = s.pricebook.find((p) => p.id === item.id && p.shopId === shopId);
    if (!existing) throw new Error('Item not found');
    Object.assign(existing, {
      name: item.name,
      trade: item.trade,
      unitAmountCents: item.unitAmountCents,
    });
    save(s);
    return existing;
  }
  const created: PricebookItem = {
    id: uid('pb'),
    shopId,
    name: item.name,
    trade: item.trade,
    unitAmountCents: item.unitAmountCents,
  };
  s.pricebook.push(created);
  save(s);
  return created;
}

export function saveInvoice(
  shopId: string,
  userId: string,
  jobId: string,
  lines: InvoiceLine[],
): Invoice {
  assertShopAccess(userId, shopId);
  const s = load();
  const job = s.jobs.find((j) => j.id === jobId && j.shopId === shopId);
  if (!job) throw new Error('Job not found');
  let invoice = s.invoices.find((i) => i.jobId === jobId && i.shopId === shopId);
  if (!invoice) {
    invoice = {
      id: uid('inv'),
      shopId,
      jobId,
      lines,
      createdAt: new Date().toISOString(),
    };
    s.invoices.push(invoice);
  } else {
    invoice.lines = lines;
  }
  save(s);
  return invoice;
}

export function collectDemoPayment(
  shopId: string,
  userId: string,
  invoiceId: string,
  amountCents: number,
  succeed = true,
): Payment {
  assertShopAccess(userId, shopId);
  const s = load();
  const invoice = s.invoices.find((i) => i.id === invoiceId && i.shopId === shopId);
  if (!invoice) throw new Error('Invoice not found');
  const shop = s.shops.find((x) => x.id === shopId);
  if (!shop?.stripeConnectAccountId) throw new Error('Shop has no Connect account');
  const payment: Payment = {
    id: uid('pay'),
    shopId,
    invoiceId,
    jobId: invoice.jobId,
    amountCents,
    status: succeed ? 'succeeded' : 'failed',
    stripePaymentIntentId: succeed ? `pi_demo_${uid('x')}` : null,
    createdAt: new Date().toISOString(),
  };
  s.payments.push(payment);
  const job = s.jobs.find((j) => j.id === invoice.jobId);
  if (job && succeed) {
    const total = invoiceTotalCents(invoice.lines);
    const remaining = remainingBalanceCents(
      total,
      s.payments.filter((p) => p.invoiceId === invoiceId),
    );
    job.paymentStatus = remaining === 0 ? 'paid' : 'partial';
  }
  save(s);
  return payment;
}

export function inviteMember(
  shopId: string,
  actorUserId: string,
  email: string,
  roles: Partial<Pick<ShopMember, 'isOwner' | 'isCsr' | 'isDispatcher' | 'isTech'>>,
): ShopMember {
  const actor = membershipFor(actorUserId, shopId);
  if (!actor?.isOwner) throw new Error('Only owners can invite');
  if (roles.isOwner) throw new Error('Cannot invite another owner in v1 demo');
  const s = load();
  const member: ShopMember = {
    id: uid('mem'),
    shopId,
    userId: uid('user'),
    email,
    isOwner: false,
    isCsr: !!roles.isCsr,
    isDispatcher: !!roles.isDispatcher,
    isTech: !!roles.isTech,
  };
  s.members.push(member);
  save(s);
  return member;
}

export function setSpiConfigured(shopId: string, userId: string, configured: boolean): void {
  const actor = membershipFor(userId, shopId);
  if (!actor?.isOwner) throw new Error('Owner only');
  const s = load();
  const shop = s.shops.find((x) => x.id === shopId);
  if (!shop) throw new Error('Shop not found');
  shop.hasSpiKey = configured;
  save(s);
}

export function enableConnect(shopId: string, userId: string): void {
  const actor = membershipFor(userId, shopId);
  if (!actor?.isOwner) throw new Error('Owner only');
  const s = load();
  const shop = s.shops.find((x) => x.id === shopId);
  if (!shop) throw new Error('Shop not found');
  shop.stripeConnectAccountId = shop.stripeConnectAccountId || `acct_demo_${shopId}`;
  save(s);
}

export function demoBriefingForAddress(address: string): import('./briefing').BriefingResponse {
  const hasPalm = /palm|west palm|wpb/i.test(address);
  return {
    groups: {
      parcel: hasPalm
        ? {
            status: 'live',
            source: 'demo-gis',
            payload: { yearBuilt: 1987, parcelId: '00-42-43-27-00-000-0010' },
          }
        : { status: 'unavailable', message: 'No parcel match in demo coverage' },
      permits: hasPalm
        ? { status: 'unavailable', message: 'No permit cache for this address' }
        : { status: 'unavailable', message: 'Outside covered cities' },
      flood: hasPalm
        ? { status: 'live', source: 'demo-nfhl', payload: { zone: 'X' } }
        : { status: 'unavailable' },
      waterSewer: { status: 'coming_soon', message: 'Not sourced in v1' },
    },
  };
}
