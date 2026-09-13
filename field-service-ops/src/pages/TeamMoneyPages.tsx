import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiPost } from '../lib/api';
import * as demo from '../lib/demo-store';
import { formatUsd, invoiceTotalCents } from '../lib/invoice';

export function TodayMoneyPage() {
  const { shop } = useAuth();
  if (!shop) return null;
  const state = demo.getState();
  const today = new Date().toISOString().slice(0, 10);
  const payments = state.payments.filter(
    (p) => p.shopId === shop.id && p.createdAt.slice(0, 10) === today && p.status === 'succeeded',
  );
  const jobs = state.jobs.filter((j) => j.shopId === shop.id && j.paymentStatus !== 'paid' && j.status === 'done');

  return (
    <div className="grid two">
      <section className="panel">
        <h2>Paid today</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.stripePaymentIntentId || p.id}</td>
                <td>{formatUsd(p.amountCents)}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={2} className="muted">
                  No successful payments today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <h2>Balance due</h2>
        <ul>
          {jobs.map((j) => {
            const inv = state.invoices.find((i) => i.jobId === j.id);
            return (
              <li key={j.id}>
                {j.address} · {inv ? formatUsd(invoiceTotalCents(inv.lines)) : 'no invoice'} ·{' '}
                <span className="badge warn">{j.paymentStatus}</span>
              </li>
            );
          })}
          {jobs.length === 0 && <li className="muted">No outstanding balances.</li>}
        </ul>
      </section>
    </div>
  );
}

export function TeamPage() {
  const { shop, user, membership, accessToken, demoMode, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [isTech, setIsTech] = useState(true);
  const [isCsr, setIsCsr] = useState(false);
  const [msg, setMsg] = useState('');

  if (!shop || !user) return null;
  const members = demoMode
    ? demo.getState().members.filter((m) => m.shopId === shop.id)
    : membership
      ? [membership]
      : [];

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    try {
      if (demoMode) {
        demo.inviteMember(shop!.id, user!.id, email, { isTech, isCsr, isDispatcher: false });
        setMsg(`Invited ${email}`);
      } else {
        const res = await apiPost<{ temporaryPassword?: string }>(
          '/api/invite-member',
          { shopId: shop!.id, email, roles: { isTech, isCsr } },
          accessToken,
        );
        setMsg(
          res.temporaryPassword
            ? `Invited ${email}. Temp password: ${res.temporaryPassword}`
            : `Invited ${email}`,
        );
      }
      setEmail('');
      refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Invite failed');
    }
  }

  return (
    <section className="panel">
      <h2>Team</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Roles</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.email}</td>
              <td>
                {[m.isOwner && 'owner', m.isCsr && 'csr', m.isDispatcher && 'dispatcher', m.isTech && 'tech']
                  .filter(Boolean)
                  .join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {membership?.isOwner ? (
          <form className="stack" onSubmit={(e) => void onInvite(e)}>
          <label>
            Invite email
            <input required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            <input type="checkbox" checked={isTech} onChange={(e) => setIsTech(e.target.checked)} /> Tech
          </label>
          <label>
            <input type="checkbox" checked={isCsr} onChange={(e) => setIsCsr(e.target.checked)} /> CSR
          </label>
          <button type="submit">Invite</button>
          {msg && <p className="muted">{msg}</p>}
        </form>
      ) : (
        <p className="muted">Only owners can invite teammates.</p>
      )}
    </section>
  );
}
