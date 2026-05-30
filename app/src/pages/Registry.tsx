import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { COUNTIES, REGIONS, slugify } from '../data/counties';
import { Hero } from '../components/Hero';
import { useUpcoming } from '../hooks/useUpcoming';
import { daysUntil, fmtShort, nextSale, verifiedFor } from '../lib/helpers';

type Filter = 'all' | 'online' | 'in-person' | 'major' | string;

export function Registry() {
  const upcoming = useUpcoming();
  const [q, setQ]           = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return COUNTIES
      .filter((c) => {
        if (filter === 'online'    && c.format !== 'online')    return false;
        if (filter === 'in-person' && c.format !== 'in-person') return false;
        if (filter === 'major'     && !c.major)                 return false;
        if (REGIONS.includes(filter as any) && c.region !== filter) return false;
        if (ql && !`${c.name} ${c.region}`.toLowerCase().includes(ql)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [q, filter]);

  return (
    <>
      <Hero />

      <section className="controls">
        <div className="controls-inner">
          <div className="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Search counties, regions…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="filters">
            {(['all', 'online', 'in-person', 'major'] as Filter[]).map((f) => (
              <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'in-person' ? 'In-Person' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            {REGIONS.slice(0, 6).map((r) => (
              <button key={r} className={`chip ${filter === r ? 'active' : ''}`} onClick={() => setFilter(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="directory">
        <div className="directory-head">
          <h2>County Registry</h2>
          <span className="count">{filtered.length} of {COUNTIES.length}</span>
        </div>
        <table className="registry">
          <thead>
            <tr>
              <th>County</th><th>Format</th><th>Property Appraiser</th><th>Clerk of Court</th>
              <th>Auction Platform</th><th>Next Sale</th><th>Verified</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const slug = slugify(c.name);
              const ns = nextSale(c.name, upcoming);
              return (
                <tr key={c.name}>
                  <td>
                    <div className="county-cell">
                      <span className="county-name">
                        <Link to={`/county/${slug}`}>{c.name}</Link>
                        {c.major && <span className="county-major">Major</span>}
                      </span>
                      <span className="county-region">{c.region}</span>
                    </div>
                  </td>
                  <td><span className={`format-badge ${c.format}`}>{c.format === 'online' ? 'Online' : 'In-Person'}</span></td>
                  <td className="cell-link"><a href={c.pa.url}    target="_blank" rel="noopener">{c.pa.label}</a></td>
                  <td className="cell-link"><a href={c.clerk.url} target="_blank" rel="noopener">{c.clerk.label}</a></td>
                  <td className="cell-link"><a href={c.auction.url} target="_blank" rel="noopener">{c.auction.label}</a></td>
                  <td className="next-sale">
                    {ns ? (
                      <>
                        <span className="nsdays">{daysUntil(ns.date)}d</span> · {fmtShort(ns.date)}
                      </>
                    ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td className="verified">{verifiedFor(c.name)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
