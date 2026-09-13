import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useShopData } from '../data/ShopDataContext';
import * as demo from '../lib/demo-store';
import { formatUsd, invoiceTotalCents } from '../lib/invoice';

export function TodayPage() {
  const { shop, user, demoMode, refresh } = useAuth();
  const { jobs, invoices, loading, error } = useShopData();
  if (!shop || !user) return null;
  const open = jobs.filter((j) => j.status !== 'done');
  const unpaid = jobs.filter((j) => j.status === 'done' && j.paymentStatus !== 'paid');

  return (
    <div className="grid two">
      <section className="panel">
        <h2>Today</h2>
        {loading && <p className="muted">Loading shop data…</p>}
        {error && <p className="badge danger">{error}</p>}
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
                  <Link to={`/app/jobs/${j.id}`}>Open</Link>
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
            ) : demoMode ? (
              <button
                type="button"
                onClick={() => {
                  demo.enableConnect(shop.id, user.id);
                  refresh();
                }}
              >
                Enable demo Connect
              </button>
            ) : (
              <span className="badge warn">
                not linked — use <Link to="/app/settings">Settings</Link>
              </span>
            )}
          </li>
          <li>
            SPI key:{' '}
            {shop.hasSpiKey ? (
              <span className="badge ok">configured</span>
            ) : demoMode ? (
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
            ) : (
              <span className="badge warn">
                configure in <Link to="/app/settings">Settings</Link>
              </span>
            )}
          </li>
        </ul>
        <p className="muted">
          Invoices in shop:{' '}
          {invoices.map((i) => formatUsd(invoiceTotalCents(i.lines))).join(', ') || 'none'}
        </p>
      </section>
    </div>
  );
}
