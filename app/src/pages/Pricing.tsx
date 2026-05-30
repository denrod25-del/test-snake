import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthModal } from '../components/AuthModal';
import { CONFIG } from '../lib/config';

export function Pricing() {
  const [search] = useSearchParams();
  const cancelled = search.get('checkout') === 'cancelled';
  const { user, isPro, startCheckout } = useAuth();
  const { open } = useAuthModal();

  const handleProClick = async () => {
    if (!user) { open('signup'); return; }
    if (isPro) return;
    await startCheckout();
  };

  return (
    <main className="detail-inner">
      <Link className="back-link" to="/">← Back to Registry</Link>
      <div className="pricing-head">
        <div className="eyebrow">Membership</div>
        <h1 className="detail-title">Simple, <em>transparent</em> pricing</h1>
        <p className="lede">Start free. Upgrade when you need unlimited watchlists, weekly alerts, and the surplus history database.</p>
      </div>

      {cancelled && <div className="pricing-notice">Checkout cancelled. No charges were made.</div>}

      <div className="pricing-grid">
        <div className="pricing-card">
          <div className="pricing-tier">Free</div>
          <div className="pricing-amount"><span className="pricing-price">$0</span><span className="pricing-per">/forever</span></div>
          <p className="pricing-desc">Enough to research one parcel a week. The full statewide directory and statute reference, on the house.</p>
          <ul className="pricing-list">
            <li>All 67 county Clerk + auction links</li>
            <li>Upcoming sales calendar (statewide)</li>
            <li>Florida Statute §197 reference</li>
            <li>Up to 5 saved parcels (local-only)</li>
            <li>5 live ArcGIS lookups per session</li>
            <li>5 PCNs per bulk-import paste</li>
            <li>1 risk flag visible (rest locked)</li>
            <li>Most recent permit visible (history locked)</li>
            <li>Email alerts for one county</li>
          </ul>
          <button className="btn-secondary" disabled>{user ? 'You\'re on Free' : 'Sign up free'}</button>
          {!user && <p className="pricing-foot">Click the button above or <a onClick={() => open('signup')} style={{ cursor: 'pointer', color: 'var(--accent-ink)' }}>create an account</a>.</p>}
        </div>

        <div className="pricing-card pro">
          <span className="pricing-badge">Pro</span>
          <div className="pricing-tier">Pro</div>
          <div className="pricing-amount"><span className="pricing-price">{CONFIG.PRO_PRICE_DISPLAY}</span><span className="pricing-per">/month</span></div>
          <p className="pricing-desc">For the investor who runs full sale lists every week and needs the data, not just the directory.</p>
          <ul className="pricing-list">
            <li><strong>Everything in Free</strong>, plus:</li>
            <li><strong>50 skip-traces / month</strong> &mdash; phones, emails, alt addresses, relatives via BatchData</li>
            <li><strong>200 AVM lookups / month</strong> &mdash; comp-based ARV from RentCast, piped into the bid calc</li>
            <li><strong>Bid calculator</strong> &mdash; recommended max bid, profit projections, all-in cost</li>
            <li><strong>Title-risk auto-flagger</strong> &mdash; full 11-rule engine (estate sales, demo permits, etc.)</li>
            <li><strong>Permit history</strong> &mdash; open, expired, recent permits per parcel</li>
            <li><strong>Unlimited live ArcGIS hydration</strong> across all 67 counties</li>
            <li><strong>Unlimited bulk imports</strong> &mdash; paste 200-row sale lists in one go</li>
            <li><strong>Unlimited cloud-synced watchlists</strong></li>
            <li>Email alerts for <strong>all 67 counties</strong></li>
            <li>Surplus history database with claim deadlines</li>
            <li>CSV export of research notebook + skip-trace results</li>
            <li>Priority email support &middot; Cancel anytime</li>
          </ul>
          <button className="btn-primary" onClick={handleProClick} disabled={isPro}>
            {isPro ? "You're on Pro" : user ? 'Upgrade to Pro' : 'Start free, upgrade later'}
          </button>
          <p className="pricing-foot">7-day refund &middot; billed via Stripe &middot; credits refill monthly</p>
        </div>
      </div>

      <section className="pricing-faq">
        <h2 className="detail-h2">Common questions</h2>
        <div className="faq-grid">
          <div>
            <h4>What is a credit?</h4>
            <p>One skip-trace credit pulls owner contact info (phones, emails, alt addresses) for one parcel. One AVM credit pulls a RentCast estimated value + comparable sales for one parcel. Pro includes 50 skip-traces and 200 AVM lookups per billing cycle. Cached results don't cost credits — once any Pro user looks up a parcel, the next 90 days (skip-trace) / 30 days (AVM) are free for everyone.</p>
          </div>
          <div>
            <h4>Can I cancel anytime?</h4>
            <p>Yes. Manage your subscription from the Account page. You retain Pro access through the end of your billing period.</p>
          </div>
          <div>
            <h4>Do you offer refunds?</h4>
            <p>Full refund within 7 days of your first payment, no questions asked. After that, payments are non-refundable. Unused credits don't carry forward more than one cycle.</p>
          </div>
          <div>
            <h4>Where does the data come from?</h4>
            <p>County Clerk websites, auction platforms (RealAuction, DeedAuction), the Florida Senate, the Palm Beach Property Appraiser ArcGIS feed, BatchData (skip-trace), and RentCast (AVM). Static data is scraped daily; live data is fetched per request.</p>
          </div>
          <div>
            <h4>Is this legal advice?</h4>
            <p>No. We are not attorneys. Always retain Florida counsel and conduct independent due diligence before bidding.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
