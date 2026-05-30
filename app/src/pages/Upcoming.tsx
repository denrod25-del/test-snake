import { Link } from 'react-router-dom';
import { useUpcoming } from '../hooks/useUpcoming';
import { daysUntil, fmtFull } from '../lib/helpers';
import { slugify } from '../data/counties';

interface Row { date: string; county: string; count?: number; opening?: string }

export function Upcoming() {
  const upcoming = useUpcoming();
  const rows: Row[] = [];
  for (const [county, sales] of Object.entries(upcoming)) {
    for (const s of sales) {
      if (daysUntil(s.date) >= 0) rows.push({ date: s.date, county, count: s.count, opening: s.opening });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.county.localeCompare(b.county));

  return (
    <section className="upcoming-section">
      <div className="up-inner">
        <div className="directory-head">
          <h2>Upcoming Florida tax deed sales</h2>
          <span className="count">{rows.length} scheduled</span>
        </div>
        <div className="up-grid">
          {rows.length === 0 && (
            <div className="up-row"><div className="up-date">—</div><div className="up-county">No upcoming sales on file. Run the scraper or check back soon.</div><div className="up-meta">—</div></div>
          )}
          {rows.map((r, i) => (
            <div className="up-row" key={`${r.date}-${r.county}-${i}`}>
              <div className="up-date">{fmtFull(r.date)}</div>
              <div className="up-county">
                <Link to={`/county/${slugify(r.county)}`}>{r.county} County</Link>
                {r.count ? ` · ${r.count} parcels` : ''}
                {r.opening ? ` · ${r.opening}` : ''}
              </div>
              <div className="up-meta">{daysUntil(r.date)}d</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
