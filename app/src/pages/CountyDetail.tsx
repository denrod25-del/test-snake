import { Link, useParams } from 'react-router-dom';
import { findCounty } from '../data/counties';
import { useUpcoming } from '../hooks/useUpcoming';
import { allUpcomingFor, daysUntil, fmtFull, scheduleFor, scheduleSummary, verifiedFor } from '../lib/helpers';
import { SURPLUS_OVERRIDES } from '../data/schedules';

export function CountyDetail() {
  const { slug = '' } = useParams();
  const county = findCounty(slug);
  const upcoming = useUpcoming();

  if (!county) {
    return (
      <main className="detail-inner">
        <Link className="back-link" to="/">← Back to Registry</Link>
        <h1 className="detail-title">County not found</h1>
        <p className="lede">No record for "{slug}". Try the directory.</p>
      </main>
    );
  }

  const sched = scheduleFor(county.name);
  const upc   = allUpcomingFor(county.name, upcoming);
  const ns    = upc[0];
  const surplus = SURPLUS_OVERRIDES[county.name] ?? { url: county.clerk.url, label: 'Contact Clerk – Tax Deeds Dept.' };

  return (
    <main className="detail-inner">
      <Link className="back-link" to="/">← Back to Registry</Link>

      <div className="detail-head">
        <div>
          <div className="eyebrow">{county.region} Region · {county.format === 'online' ? 'Online Auction' : 'In-Person Sale'}</div>
          <h1 className="detail-title">{county.name} <em>County</em></h1>
          <p className="lede">Verified directory of {county.name} County Property Appraiser, Clerk of Court (Tax Deeds), auction platform, and sale cadence. Independently confirm with the Clerk before relying on this data.</p>
        </div>
        <div className="detail-meta">
          <div className="meta-row"><span className="meta-lbl">Region</span><span className="meta-val">{county.region}</span></div>
          <div className="meta-row"><span className="meta-lbl">Format</span><span className="meta-val">{county.format === 'online' ? 'Online' : 'In-Person'}</span></div>
          <div className="meta-row"><span className="meta-lbl">Cadence</span><span className="meta-val">{scheduleSummary(sched)}</span></div>
          <div className="meta-row"><span className="meta-lbl">Last verified</span><span className="meta-val">{verifiedFor(county.name)}</span></div>
        </div>
      </div>

      {ns && (
        <div className="next-sale-banner">
          <div className="nsl-l">
            <span className="nsl-eye">Next Scheduled Sale</span>
            <span className="nsl-date">{fmtFull(ns.date)}</span>
            <span className="nsl-meta">{daysUntil(ns.date)} days from today {ns.count ? ` · ${ns.count} parcels listed` : ''}{ns.opening ? ` · ${ns.opening}` : ''}</span>
          </div>
          <a href={county.auction.url} target="_blank" rel="noopener" className="nsl-btn">View Auction →</a>
        </div>
      )}

      <div className="detail-grid">
        <div className="detail-block">
          <div className="block-num">01</div>
          <h3>Property Appraiser</h3>
          <p>Lookup parcel data, ownership history, assessed value, lot dimensions, and zoning before you bid.</p>
          <a className="block-link" href={county.pa.url} target="_blank" rel="noopener">{county.pa.label} →</a>
        </div>
        <div className="detail-block highlight">
          <div className="block-num">02</div>
          <h3>Auction Platform</h3>
          <p>{county.format === 'online' ? 'Where the sale actually happens. Register, fund your deposit, and place bids.' : 'Sales are conducted in person at the courthouse.'}</p>
          <a className="block-link" href={county.auction.url} target="_blank" rel="noopener">{county.auction.label} →</a>
        </div>
        <div className="detail-block">
          <div className="block-num">03</div>
          <h3>Clerk of Court</h3>
          <p>Tax deed application records, sale notices, surplus claims, and the official statutory record for every sale.</p>
          <a className="block-link" href={county.clerk.url} target="_blank" rel="noopener">{county.clerk.label} →</a>
        </div>
      </div>

      {upc.length > 0 && (
        <div className="detail-section">
          <h2 className="detail-h2">Upcoming sales</h2>
          <div className="up-grid">
            {upc.map((s) => (
              <div className="up-row" key={s.date}>
                <div className="up-date">{fmtFull(s.date)}</div>
                <div className="up-county">{s.count ? `${s.count} parcels listed` : 'Sale on calendar'}{s.opening ? ` · ${s.opening}` : ''}</div>
                <div className="up-meta">{daysUntil(s.date)}d</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="detail-section">
        <h2 className="detail-h2">Surplus funds</h2>
        <div className="s-card" style={{ maxWidth: 480 }}>
          <h4>{county.name} County Clerk</h4>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>Surplus from tax deed sales is held by the Clerk for 120 days under FS §197.582. Contact the Tax Deeds department to file a claim.</p>
          <a href={surplus.url} target="_blank" rel="noopener">{surplus.label} →</a>
        </div>
      </div>
    </main>
  );
}
