import { FormEvent, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PropertyBriefingPanel } from '../components/PropertyBriefingPanel';
import { InvoiceBuilder } from '../components/InvoiceBuilder';
import { JobStatusControls } from '../components/JobStatusControls';
import * as demo from '../lib/demo-store';
import { formatUsd, invoiceTotalCents, remainingBalanceCents } from '../lib/invoice';
import type { InvoiceLine } from '../lib/types';

export function JobDetailPage({ mode }: { mode: 'office' | 'tech' }) {
  const { jobId = '' } = useParams();
  const { shop, user, refresh } = useAuth();
  const [notes, setNotes] = useState('');
  const [payMsg, setPayMsg] = useState('');

  const state = demo.getState();
  const job = state.jobs.find((j) => j.id === jobId);
  const invoice = state.invoices.find((i) => i.jobId === jobId);
  const payments = state.payments.filter((p) => p.jobId === jobId);
  const pricebook = shop ? state.pricebook.filter((p) => p.shopId === shop.id) : [];

  const lines = useMemo(() => invoice?.lines || [], [invoice]);
  const total = invoiceTotalCents(lines);
  const remaining = remainingBalanceCents(total, payments);

  if (!shop || !user) return null;
  if (!job || job.shopId !== shop.id) {
    return (
      <section className="panel">
        <p>Job not found in this shop.</p>
        <Link to={mode === 'tech' ? '/tech' : '/app/dispatch'}>Back</Link>
      </section>
    );
  }

  function saveNotes(e: FormEvent) {
    e.preventDefault();
    demo.updateJobNotes(shop!.id, user!.id, job!.id, notes || job!.notes);
    refresh();
  }

  function onSaveInvoice(next: InvoiceLine[]) {
    demo.saveInvoice(shop!.id, user!.id, job!.id, next);
    refresh();
  }

  function collect(succeed: boolean) {
    try {
      if (!invoice) {
        setPayMsg('Build an invoice first.');
        return;
      }
      const amount = remaining || total;
      demo.collectDemoPayment(shop!.id, user!.id, invoice.id, amount, succeed);
      setPayMsg(succeed ? 'Payment collected (demo).' : 'Payment failed (demo).');
      refresh();
    } catch (err) {
      setPayMsg(err instanceof Error ? err.message : 'Pay failed');
    }
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
            demo.updateJobStatus(shop.id, user.id, job.id, status);
            refresh();
          }}
        />
        <p style={{ marginTop: '0.75rem' }}>
          Payment: <span className={`badge ${job.paymentStatus === 'paid' ? 'ok' : 'warn'}`}>{job.paymentStatus}</span>
        </p>
      </section>

      <section className="panel">
        <h2>Notes / photos</h2>
        <form className="stack" onSubmit={saveNotes}>
          <textarea
            defaultValue={job.notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Field notes"
          />
          <label>
            Add photo (demo stores data URL)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  demo.updateJobNotes(shop.id, user.id, job.id, notes || job.notes, String(reader.result));
                  refresh();
                };
                reader.readAsDataURL(file);
              }}
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

      <InvoiceBuilder pricebook={pricebook} lines={lines} onSave={onSaveInvoice} />

      <section className="panel">
        <h2>On-site pay</h2>
        <p className="muted">
          Demo Payment Element stand-in. Production uses Stripe Connect + Payment Element on the
          connected account.
        </p>
        <p>
          Total {formatUsd(total)} · Remaining {formatUsd(remaining)}
        </p>
        <div className="status-row">
          <button type="button" onClick={() => collect(true)} disabled={!invoice || remaining === 0}>
            Collect card (demo success)
          </button>
          <button type="button" className="secondary" onClick={() => collect(false)} disabled={!invoice}>
            Simulate failure
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              demo.updateJobStatus(shop.id, user.id, job.id, 'done');
              refresh();
            }}
          >
            Mark done unpaid
          </button>
        </div>
        {payMsg && <p className="muted">{payMsg}</p>}
      </section>

      <PropertyBriefingPanel address={job.address} shopHasSpi={shop.hasSpiKey} />
    </div>
  );
}
