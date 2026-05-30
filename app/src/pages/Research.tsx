import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { COUNTIES, slugify } from '../data/counties';
import { useAuth } from '../contexts/AuthContext';
import { useAuthModal } from '../components/AuthModal';
import {
  STATUS_OPTIONS, createBlankParcel, deleteParcelFromCloud, loadParcels,
  pushParcelToCloud, saveParcels,
} from '../lib/parcels';
import type { Parcel, ParcelStatus } from '../lib/types';
import { CONFIG } from '../lib/config';

const FREE_LIMIT = 5;

export function Research() {
  const { user, isPro } = useAuth();
  const { open } = useAuthModal();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => { setParcels(loadParcels()); }, []);

  const persist = (next: Parcel[]) => { setParcels(next); saveParcels(next); };
  const limited = !isPro && parcels.length >= FREE_LIMIT;

  const addParcel = async () => {
    if (limited) {
      open('signup');
      return;
    }
    const p = createBlankParcel(slugify(COUNTIES[0].name));
    const next = [p, ...parcels];
    persist(next);
    setEditing(p.id);
    if (isPro && user) await pushParcelToCloud(user.id, p);
  };

  const updateParcel = async (id: string, patch: Partial<Parcel>) => {
    const next = parcels.map((p) => p.id === id ? { ...p, ...patch, updated: Date.now() } : p);
    persist(next);
    if (isPro && user) {
      const p = next.find((x) => x.id === id);
      if (p) await pushParcelToCloud(user.id, p);
    }
  };

  const deleteParcel = async (id: string) => {
    if (!confirm('Delete this parcel?')) return;
    persist(parcels.filter((p) => p.id !== id));
    if (isPro && user) await deleteParcelFromCloud(user.id, id);
  };

  const grouped = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of parcels) m[p.status] = (m[p.status] ?? 0) + 1;
    return m;
  }, [parcels]);

  return (
    <main className="detail-inner">
      <Link className="back-link" to="/">← Back to Registry</Link>
      <div className="detail-head">
        <div>
          <div className="eyebrow">Tools</div>
          <h1 className="detail-title">Research <em>notebook</em></h1>
          <p className="lede">Track every parcel you research: PA value, opening bid, max bid, lien notes, and current status. Free accounts can save up to {FREE_LIMIT} parcels locally; Pro members get unlimited cloud-synced watchlists.</p>
        </div>
        <div className="detail-meta">
          <div className="meta-row"><span className="meta-lbl">Saved parcels</span><span className="meta-val">{parcels.length}{!isPro && ` / ${FREE_LIMIT}`}</span></div>
          {STATUS_OPTIONS.map((s) => (
            <div className="meta-row" key={s.value}><span className="meta-lbl">{s.label}</span><span className="meta-val">{grouped[s.value] ?? 0}</span></div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
        <button className="btn-primary" onClick={addParcel}>+ Add parcel</button>
        {!isPro && (
          <Link to="/pricing" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>
            Upgrade to Pro for unlimited
          </Link>
        )}
      </div>

      {limited && (
        <div className="pricing-notice">
          You've reached the free tier limit of {FREE_LIMIT} parcels. <Link to="/pricing">Upgrade to Pro</Link> for unlimited cloud-synced watchlists.
        </div>
      )}

      <div className="parcel-grid">
        {parcels.length === 0 && <p style={{ color: 'var(--muted)' }}>No parcels saved yet. Click "+ Add parcel" to start.</p>}
        {parcels.map((p) => (
          <ParcelCard
            key={p.id}
            parcel={p}
            editing={editing === p.id}
            onEdit={() => setEditing(editing === p.id ? null : p.id)}
            onDelete={() => deleteParcel(p.id)}
            onChange={(patch) => updateParcel(p.id, patch)}
          />
        ))}
      </div>

      {!CONFIG.AUTH_ENABLED && (
        <div className="pricing-notice" style={{ marginTop: 32 }}>
          <strong>Demo mode.</strong> Auth/billing isn't configured (set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>). Parcels persist to local storage only.
        </div>
      )}
    </main>
  );
}

interface CardProps {
  parcel: Parcel;
  editing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<Parcel>) => void;
}

function ParcelCard({ parcel: p, editing, onEdit, onDelete, onChange }: CardProps) {
  const county = COUNTIES.find((c) => slugify(c.name) === p.countySlug);
  return (
    <article className="parcel-card">
      <div className="parcel-head">
        <div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 600, fontSize: 20 }}>
            {p.parcelId || 'Untitled parcel'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            {county?.name ?? 'Unknown'} County · updated {new Date(p.updated).toLocaleDateString()}
          </div>
        </div>
        <div className="parcel-actions">
          <span className="parcel-status">{STATUS_OPTIONS.find((s) => s.value === p.status)?.label}</span>
          <button onClick={onEdit}>{editing ? 'Done' : 'Edit'}</button>
          <button onClick={onDelete}>Delete</button>
        </div>
      </div>

      {!editing ? (
        <div style={{ fontSize: 13, color: '#3a3a3a', display: 'grid', gap: 4 }}>
          {p.address  && <div><strong>Address:</strong> {p.address}</div>}
          {p.owner    && <div><strong>Owner:</strong> {p.owner}</div>}
          {p.assessed && <div><strong>Assessed:</strong> {p.assessed}</div>}
          {p.opening  && <div><strong>Opening bid:</strong> {p.opening}</div>}
          {p.max      && <div><strong>Max bid:</strong> {p.max}</div>}
          {p.notes    && <div style={{ marginTop: 8, fontStyle: 'italic' }}>{p.notes}</div>}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          <Field label="County" value={p.countySlug}
                 input={<select value={p.countySlug} onChange={(e) => onChange({ countySlug: e.target.value })}>
                   {COUNTIES.map((c) => <option key={c.name} value={slugify(c.name)}>{c.name}</option>)}
                 </select>} />
          <Field label="Parcel ID"  input={<input value={p.parcelId} onChange={(e) => onChange({ parcelId: e.target.value })} />} />
          <Field label="Address"    input={<input value={p.address}  onChange={(e) => onChange({ address:  e.target.value })} />} />
          <Field label="Owner"      input={<input value={p.owner}    onChange={(e) => onChange({ owner:    e.target.value })} />} />
          <Field label="Assessed $" input={<input value={p.assessed} onChange={(e) => onChange({ assessed: e.target.value })} />} />
          <Field label="Opening $"  input={<input value={p.opening}  onChange={(e) => onChange({ opening:  e.target.value })} />} />
          <Field label="Max bid $"  input={<input value={p.max}      onChange={(e) => onChange({ max:      e.target.value })} />} />
          <Field label="Notes"      input={<textarea rows={3} value={p.notes} onChange={(e) => onChange({ notes: e.target.value })} />} />
          <Field label="Status"
                 input={<select value={p.status} onChange={(e) => onChange({ status: e.target.value as ParcelStatus })}>
                   {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                 </select>} />
        </div>
      )}
    </article>
  );
}

function Field({ label, input }: { label: string; value?: string; input: React.ReactNode }) {
  return (
    <label className="form-field" style={{ marginBottom: 0 }}>
      <span className="form-lbl">{label}</span>
      {input}
    </label>
  );
}
