import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { STATUTE_SECTIONS } from '../data/statutes';

export function Statute() {
  const [q, setQ]               = useState('');
  const [criticalOnly, setOnly] = useState(false);

  const visible = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return STATUTE_SECTIONS.filter((s) => {
      if (criticalOnly && !s.critical) return false;
      if (!ql) return true;
      return `${s.id} ${s.title} ${s.summary} ${s.why}`.toLowerCase().includes(ql);
    });
  }, [q, criticalOnly]);

  return (
    <main className="detail-inner">
      <Link className="back-link" to="/">← Back to Registry</Link>
      <div className="detail-head">
        <div>
          <div className="eyebrow">Florida Statutes</div>
          <h1 className="detail-title">Chapter 197 <em>— Reference</em></h1>
          <p className="lede">A working investor's reference to the statutes that govern Florida tax certificates, tax deed applications, sales, and surplus claims. Curated summaries with direct links to the official statutory text.</p>
        </div>
        <div className="detail-meta">
          <div className="meta-row"><span className="meta-lbl">Title</span><span className="meta-val">Tax Collections, Sales & Liens</span></div>
          <div className="meta-row"><span className="meta-lbl">Sections Indexed</span><span className="meta-val">{STATUTE_SECTIONS.length}</span></div>
          <div className="meta-row"><span className="meta-lbl">Source</span><span className="meta-val"><a href="https://www.flsenate.gov/Laws/Statutes/2024/Chapter197" target="_blank" rel="noopener">flsenate.gov ↗</a></span></div>
        </div>
      </div>

      <div className="statute-controls">
        <div className="search" style={{ flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sections by number, title, or keyword…" />
        </div>
        <div className="filters">
          <button className={`chip ${!criticalOnly ? 'active' : ''}`} onClick={() => setOnly(false)}>All Sections</button>
          <button className={`chip ${ criticalOnly ? 'active' : ''}`} onClick={() => setOnly(true)}>Critical Only</button>
        </div>
      </div>

      <div className="statute-toc">
        {STATUTE_SECTIONS.map((s) => (
          <a key={s.id} className={`toc-link ${s.critical ? 'critical' : ''}`} href={`#statute-${s.id}`}>
            <span className="toc-num">§{s.id}</span>
            <span className="toc-title">{s.title}</span>
          </a>
        ))}
      </div>

      <div className="statute-list">
        {visible.map((s) => (
          <article key={s.id} id={`statute-${s.id}`} className={`statute-card ${s.critical ? 'critical' : ''}`}>
            <header className="statute-head">
              <div className="statute-num">§{s.id}</div>
              {s.critical && <span className="statute-tag">Critical</span>}
            </header>
            <h3 className="statute-title">{s.title}</h3>
            <p className="statute-body">{s.summary}</p>
            <p className="statute-why"><strong>Why it matters</strong>{s.why}</p>
            {s.href && (
              <footer className="statute-foot">
                <a href={s.href} target="_blank" rel="noopener">Read on flsenate.gov ↗</a>
              </footer>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
