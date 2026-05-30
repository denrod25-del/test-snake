import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthModal } from '../components/AuthModal';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../lib/helpers';
import type { SurplusRecord } from '../lib/types';

const PREVIEW: SurplusRecord[] = [
  { id: 'demo-1', county: 'Orange',     sale_date: '2026-03-04', parcel_id: '23-22-30-1234-00-010', property_addr: '1247 Magnolia Ave, Orlando',  prior_owner: 'Williams Family Trust', surplus_amount: 18420, status: 'unclaimed', claim_deadline: '2026-07-02', source_url: null },
  { id: 'demo-2', county: 'Miami-Dade', sale_date: '2026-02-18', parcel_id: '01-3120-016-2010',     property_addr: '845 NW 12th St, Miami',       prior_owner: 'Joaquin Reyes',         surplus_amount: 32750, status: 'unclaimed', claim_deadline: '2026-06-18', source_url: null },
  { id: 'demo-3', county: 'Broward',    sale_date: '2026-01-21', parcel_id: '5042-12-04-1100',      property_addr: '2310 Sheridan St, Hollywood', prior_owner: 'Estate of L. Brown',    surplus_amount: 27110, status: 'claim_filed', claim_deadline: '2026-05-21', source_url: null },
  { id: 'demo-4', county: 'Palm Beach', sale_date: '2026-01-14', parcel_id: '00-43-44-15-04-005',   property_addr: '5618 Lake Worth Rd, Lake Worth', prior_owner: 'Rodriguez Investments', surplus_amount: 14225, status: 'unclaimed', claim_deadline: '2026-05-14', source_url: null },
];

export function SurplusHistory() {
  const { user, isPro } = useAuth();
  const { open } = useAuthModal();
  const [records, setRecords] = useState<SurplusRecord[] | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [q, setQ]             = useState('');
  const [filter, setFilter]   = useState<'all' | 'unclaimed' | 'claim_filed'>('all');

  useEffect(() => {
    if (!isPro || !supabase) return;
    setError(null);
    void supabase.from('surplus_history')
      .select('*')
      .order('sale_date', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRecords(((data ?? []) as SurplusRecord[]));
      });
  }, [isPro]);

  const filtered = useMemo(() => {
    if (!records) return null;
    const ql = q.trim().toLowerCase();
    return records.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!ql) return true;
      return `${r.county} ${r.parcel_id ?? ''} ${r.property_addr ?? ''} ${r.prior_owner ?? ''}`.toLowerCase().includes(ql);
    });
  }, [records, q, filter]);

  if (!isPro) {
    return (
      <main className="detail-inner">
        <Link className="back-link" to="/">← Back to Registry</Link>
        <div className="detail-head">
          <div>
            <div className="eyebrow">Pro feature</div>
            <h1 className="detail-title">Surplus <em>history</em></h1>
            <p className="lede">Backfilled surplus-funds records from across Florida, with claim deadlines, source URLs, and weekly updates from our scrapers. Pro members can search, filter, and export.</p>
          </div>
        </div>

        <div className="paywall">
          <div className="paywall-inner">
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, letterSpacing: '.1em', textTransform: 'uppercase' }}>Preview</div>
            <div className="paywall-preview">
              {PREVIEW.map((r) => (
                <div className="paywall-row" key={r.id}>
                  <div>
                    <strong>{r.county} County</strong><br />
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Sale {fmtDate(r.sale_date)} · Claim by {fmtDate(r.claim_deadline!)}</span>
                  </div>
                  <div>{r.property_addr}<br /><span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{r.prior_owner}</span></div>
                  <span className="amt">${r.surplus_amount.toLocaleString()}</span>
                  <span className={`status status-pill ${r.status}`}>{r.status.replace('_', ' ')}</span>
                </div>
              ))}
              <div className="paywall-fade" />
            </div>

            <div className="paywall-cta">
              <h3>Unlock the full surplus history database</h3>
              <p>Hundreds of records across all 67 counties, weekly auto-updates, claim deadlines, and source links. {!user ? 'Create a free account to upgrade.' : 'Available on Pro for $49/month.'}</p>
              {user ? <Link to="/pricing" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Upgrade to Pro</Link>
                    : <button className="btn-primary" onClick={() => open('signup')}>Get started</button>}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="detail-inner">
      <Link className="back-link" to="/">← Back to Registry</Link>
      <div className="detail-head">
        <div>
          <div className="eyebrow">Pro · Live database</div>
          <h1 className="detail-title">Surplus <em>history</em></h1>
          <p className="lede">Searchable database of Florida tax deed surplus funds, updated weekly from county Clerk websites.</p>
        </div>
        <div className="detail-meta">
          <div className="meta-row"><span className="meta-lbl">Records loaded</span><span className="meta-val">{records?.length ?? '—'}</span></div>
          <div className="meta-row"><span className="meta-lbl">Updated</span><span className="meta-val">Weekly · Tuesday</span></div>
          <div className="meta-row"><span className="meta-lbl">Source</span><span className="meta-val">FS §197.582 surplus tracking</span></div>
        </div>
      </div>

      <div className="statute-controls">
        <div className="search" style={{ flex: 1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by county, parcel, address, owner…" />
        </div>
        <div className="filters">
          <button className={`chip ${filter === 'all' ? 'active' : ''}`}         onClick={() => setFilter('all')}>All</button>
          <button className={`chip ${filter === 'unclaimed' ? 'active' : ''}`}   onClick={() => setFilter('unclaimed')}>Unclaimed</button>
          <button className={`chip ${filter === 'claim_filed' ? 'active' : ''}`} onClick={() => setFilter('claim_filed')}>Claim filed</button>
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {!filtered && <p style={{ color: 'var(--muted)' }}>Loading surplus records…</p>}
      {filtered && filtered.length === 0 && <p style={{ color: 'var(--muted)' }}>No records match your filters.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered?.map((r) => (
          <div className="paywall-row" key={r.id} style={{ background: 'var(--paper-2)', padding: '14px 18px', border: '1px solid var(--rule)' }}>
            <div>
              <strong>{r.county} County</strong><br />
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                Sale {fmtDate(r.sale_date)} · Claim by {r.claim_deadline ? fmtDate(r.claim_deadline) : '—'}
              </span>
            </div>
            <div>
              {r.property_addr ?? r.parcel_id ?? '—'}
              <br />
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                {r.prior_owner ?? '—'} {r.parcel_id && `· ${r.parcel_id}`}
              </span>
            </div>
            <span className="amt">${r.surplus_amount.toLocaleString()}</span>
            <span className={`status status-pill ${r.status}`}>{r.status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
