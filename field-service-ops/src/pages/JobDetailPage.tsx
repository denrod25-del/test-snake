import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PropertyBriefingPanel } from '../components/PropertyBriefingPanel';
import { InvoiceBuilder } from '../components/InvoiceBuilder';
import { JobStatusControls } from '../components/JobStatusControls';
import { OnSitePayPanel } from '../components/OnSitePayPanel';
import { useShopData } from '../data/ShopDataContext';
import { formatUsd, invoiceTotalCents, remainingBalanceCents } from '../lib/invoice';
import type { InvoiceLine } from '../lib/types';

export function JobDetailPage({ mode }: { mode: 'office' | 'tech' }) {
  const { jobId = '' } = useParams();
  const { shop, user, accessToken, demoMode } = useAuth();
  const {
    jobs,
    invoices,
    payments,
    pricebook,
    updateJobStatus,
    updateJobNotes,
    saveInvoice,
    collectDemoPayment,
    refreshData,
  } = useShopData();
  const [notes, setNotes] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const job = jobs.find((j) => j.id === jobId);
  const invoice = invoices.find((i) => i.jobId === jobId);
  const jobPayments = payments.filter((p) => p.jobId === jobId);
  const lines = useMemo(() => invoice?.lines || [], [invoice]);
  const total = invoiceTotalCents(lines);
  const remaining = remainingBalanceCents(total, jobPayments);

  if (!shop || !user) return null;
  if (!job || job.shopId !== shop.id) {
    return (
      <section className="panel">
        <p>Job not found in this shop.</p>
        <Link to={mode === 'tech' ? '/tech' : '/app/dispatch'}>Back</Link>
      </section>
    );
  }

  async function saveNotes(e: FormEvent) {
    e.preventDefault();
    await updateJobNotes(job!.id, notes || job!.notes, photoFile || undefined);
    setPhotoFile(null);
  }

  async function onSaveInvoice(next: InvoiceLine[]) {
    await saveInvoice(job!.id, next);
  }

  return (
    <div className="stack">
      <section className="panel">
        <p className="muted">
          <Link to={mode === 'tech' ? '/tech' : '/app/dispatch'}>← Back</Link>
        </p>
        <h2>
          {job.trade} · {job.address}
        </h2>
        <p>{job.description}</p>
        <p className="muted">Window: {job.preferredWindow}</p>
        <JobStatusControls
          status={job.status}
          onChange={(status) => {
            void updateJobStatus(job.id, status);
          }}
        />
        <p style={{ marginTop: '0.75rem' }}>
          Payment:{' '}
          <span className={`badge ${job.paymentStatus === 'paid' ? 'ok' : 'warn'}`}>
            {job.paymentStatus}
          </span>
        </p>
      </section>

      <section className="panel">
        <h2>Notes / photos</h2>
        <form className="stack" onSubmit={(e) => void saveNotes(e)}>
          <textarea
            defaultValue={job.notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Field notes"
          />
          <label>
            Add photo {demoMode ? '(demo stores data URL)' : '(private Storage)'}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            />
          </label>
          <button type="submit">Save notes</button>
        </form>
        <div className="stack" style={{ marginTop: '0.75rem' }}>
          {job.photoUrls.map((src, i) => (
            <img key={i} src={src} alt="" style={{ maxWidth: '100%', borderRadius: 12 }} />
          ))}
        </div>
      </section>

      <InvoiceBuilder
        key={`${invoice?.id || 'new'}-${lines.map((l) => l.id).join(',')}`}
        pricebook={pricebook}
        lines={lines}
        onSave={(next) => void onSaveInvoice(next)}
      />

      <OnSitePayPanel
        shopId={shop.id}
        jobId={job.id}
        invoiceId={invoice?.id || null}
        amountCents={remaining || total}
        accessToken={accessToken}
        demoMode={demoMode}
        disabled={!invoice || remaining === 0}
        onDemoCollect={async (succeed) => {
          if (!invoice) throw new Error('Build an invoice first.');
          await collectDemoPayment(invoice.id, remaining || total, succeed);
        }}
        onLivePaid={() => {
          void refreshData();
        }}
      />

      <div className="status-row">
        <button
          type="button"
          className="secondary"
          onClick={() => void updateJobStatus(job.id, 'done')}
        >
          Mark done unpaid
        </button>
        <span className="muted">
          Total {formatUsd(total)} · Remaining {formatUsd(remaining)}
        </span>
      </div>

      <PropertyBriefingPanel
        address={job.address}
        shopId={shop.id}
        jobId={job.id}
        shopHasSpi={shop.hasSpiKey}
        accessToken={accessToken}
        demoMode={demoMode}
      />
    </div>
  );
}
