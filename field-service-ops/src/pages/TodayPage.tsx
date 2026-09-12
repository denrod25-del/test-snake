import { useAuth } from '../auth/AuthContext';
import * as demo from '../lib/demo-store';
import { formatUsd, invoiceTotalCents } from '../lib/invoice';

export function TodayPage() {
  const { shop, user, refresh } = useAuth();
  if (!shop || !user) return null;
  const state = demo.getState();
  const jobs = state.jobs.filter((j) => j.shopId === shop.id);
  const open = jobs.filter((j) => j.status !== 'done');
  const unpaid = jobs.filter((j) => j.status === 'done' && j.paymentStatus !== 'paid');

  return (
    <div className="grid two">
      <section className="panel">
        <h2>Today</h2>
        <p className="muted">
          {open.length} open jobs · {unpaid.length} done with balance due
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Status</th>
              <th>Pay</th>
            </tr>
          </thead>
          <tbody>
            {jobs.slice(0, 12).map((j) => (
              <tr key={j.id}>
                <td>
                  <strong>{j.trade}</strong>
                  <div className="muted">{j.address}</div>
                </td>
                <td>
                  <span className="badge">{j.status}</span>
                </td>
                <td>
                  <span className={`badge ${j.paymentStatus === 'paid' ? 'ok' : 'warn'}`}>
                    {j.paymentStatus}
                  </span>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  No jobs yet — book a call or confirm a request.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <h2>Quick links</h2>
        <ul className="stack">
          <li>
            Public request URL: <code>/r/{shop.slug}</code>
          </li>
          <li>
            Stripe Connect:{' '}
            {shop.stripeConnectAccountId ? (
              <span className="badge ok">linked</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  demo.enableConnect(shop.id, user.id);
                  refresh();
                }}
              >
                Enable demo Connect
              </button>
            )}
          </li>
          <li>
            SPI key:{' '}
            {shop.hasSpiKey ? (
              <span className="badge ok">configured</span>
            ) : (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  demo.setSpiConfigured(shop.id, user.id, true);
                  refresh();
                }}
              >
                Mark SPI configured
              </button>
            )}
          </li>
        </ul>
        <p className="muted">
          Demo invoices in shop:{' '}
          {state.invoices
            .filter((i) => i.shopId === shop.id)
            .map((i) => formatUsd(invoiceTotalCents(i.lines)))
            .join(', ') || 'none'}
        </p>
      </section>
    </div>
  );
}
