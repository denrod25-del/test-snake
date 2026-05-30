import { Link } from 'react-router-dom';
import { COUNTIES, slugify } from '../data/counties';
import { SURPLUS_OVERRIDES } from '../data/schedules';

export function Surplus() {
  return (
    <section className="surplus-section">
      <div className="s-inner">
        <div className="directory-head">
          <h2>Surplus funds — by county</h2>
          <span className="count">120-day window · FS §197.582</span>
        </div>
        <p style={{ maxWidth: 760, color: '#4a4a4a', marginBottom: 28 }}>
          When a tax deed sale closes for more than the opening bid, the difference is held by the Clerk
          for the prior owner and lienholders. Claims must be filed within 120 days of the sale.
          Use the links below to reach each Clerk's surplus or tax-deed contact page. Pro members can also
          access our scraped surplus history database for backfilled records.
          {' '}<Link to="/surplus-history">View surplus history →</Link>
        </p>
        <div className="s-grid">
          {COUNTIES.map((c) => {
            const o = SURPLUS_OVERRIDES[c.name] ?? { url: c.clerk.url, label: 'Clerk – Tax Deeds dept.' };
            return (
              <div className="s-card" key={c.name}>
                <h4><Link to={`/county/${slugify(c.name)}`}>{c.name}</Link></h4>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px' }}>{c.region}</p>
                <a href={o.url} target="_blank" rel="noopener">{o.label} →</a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
