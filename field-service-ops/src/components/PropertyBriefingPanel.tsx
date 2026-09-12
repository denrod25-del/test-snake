import { useState } from 'react';
import { demoBriefingForAddress } from '../lib/demo-store';
import { normalizeBriefing, trustLabel, type BriefingResponse } from '../lib/briefing';

export function PropertyBriefingPanel({
  address,
  shopHasSpi,
}: {
  address: string;
  shopHasSpi: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [error, setError] = useState('');

  function load() {
    setOpen(true);
    if (!shopHasSpi) {
      setData(null);
      setError('SPI key not configured for this shop. Job work continues without briefing.');
      return;
    }
    try {
      setData(normalizeBriefing(demoBriefingForAddress(address)));
      setError('');
    } catch {
      setError('Briefing unavailable');
      setData(null);
    }
  }

  return (
    <section className="panel">
      <h2>Property briefing</h2>
      <p className="muted">Optional Florida add-on — not required to finish or get paid.</p>
      <button type="button" className="secondary" onClick={load}>
        {open ? 'Refresh briefing' : 'Open property briefing'}
      </button>
      {error && <p className="badge warn">{error}</p>}
      {data && (
        <div className="stack" style={{ marginTop: '0.75rem' }}>
          {Object.entries(data.groups).map(([key, group]) =>
            group ? (
              <div key={key}>
                <strong style={{ textTransform: 'capitalize' }}>{key}</strong>{' '}
                <span className="trust badge">{trustLabel(group.status)}</span>
                {group.message && <div className="muted">{group.message}</div>}
                {group.payload && (
                  <pre style={{ margin: '0.35rem 0 0', fontSize: 12, overflow: 'auto' }}>
                    {JSON.stringify(group.payload, null, 2)}
                  </pre>
                )}
              </div>
            ) : null,
          )}
        </div>
      )}
    </section>
  );
}
