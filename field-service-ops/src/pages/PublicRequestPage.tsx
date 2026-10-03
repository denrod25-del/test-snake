import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiPost } from '../lib/api';
import { isDemoMode, supabase } from '../lib/supabase';
import * as demo from '../lib/demo-store';
import type { Trade } from '../lib/types';

export function PublicRequestPage() {
  const { shopSlug = '' } = useParams();
  const [shopName, setShopName] = useState<string | null>(null);
  const [shopMissing, setShopMissing] = useState(false);
  const [trade, setTrade] = useState<Trade>('plumbing');
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [preferredWindow, setPreferredWindow] = useState('ASAP');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isDemoMode) {
        const shop = demo.getState().shops.find((s) => s.slug === shopSlug);
        if (!cancelled) {
          if (shop) setShopName(shop.name);
          else setShopMissing(true);
        }
        return;
      }
      if (!supabase) {
        setShopMissing(true);
        return;
      }
      const { data, error } = await supabase.rpc('get_public_shop', { p_slug: shopSlug });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (!error && row?.name) setShopName(String(row.name));
      else setShopMissing(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [shopSlug]);

  if (shopMissing) {
    return (
      <div className="hero-login">
        <div className="hero-card">
          <h1>Shop not found</h1>
          <p className="muted">No public request page for “{shopSlug}”.</p>
          <Link to="/login">Back</Link>
        </div>
      </div>
    );
  }

  if (!shopName) {
    return (
      <div className="hero-login">
        <div className="hero-card muted">Loading…</div>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (isDemoMode) {
        demo.createPublicRequest(shopSlug, {
          trade,
          description,
          contactName,
          contactPhone,
          address,
          preferredWindow,
        });
      } else {
        await apiPost('/api/create-public-request', {
          slug: shopSlug,
          trade,
          description,
          contactName,
          contactPhone,
          address,
          preferredWindow,
        });
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="hero-login">
      <div className="hero-card stack">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            Request service
          </p>
          <h1>{shopName}</h1>
          <p className="muted">Office will confirm your appointment — this is not self-scheduling.</p>
        </div>
        {done ? (
          <p className="badge ok">Request submitted. The office will follow up.</p>
        ) : (
          <form className="stack" onSubmit={(e) => void onSubmit(e)}>
            <label>
              Trade
              <select value={trade} onChange={(e) => setTrade(e.target.value as Trade)}>
                <option value="plumbing">Plumbing</option>
                <option value="hvac">HVAC</option>
                <option value="electrical">Electrical</option>
              </select>
            </label>
            <label>
              Your name
              <input required value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </label>
            <label>
              Phone
              <input required value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </label>
            <label>
              Service address
              <input required value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            <label>
              What do you need?
              <textarea required value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label>
              Preferred window
              <input value={preferredWindow} onChange={(e) => setPreferredWindow(e.target.value)} />
            </label>
            {error && <p className="badge danger">{error}</p>}
            <button type="submit">Submit request</button>
          </form>
        )}
      </div>
    </div>
  );
}
