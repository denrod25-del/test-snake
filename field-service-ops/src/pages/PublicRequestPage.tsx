import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as demo from '../lib/demo-store';
import type { Trade } from '../lib/types';

export function PublicRequestPage() {
  const { shopSlug = '' } = useParams();
  const shop = demo.getState().shops.find((s) => s.slug === shopSlug);
  const [trade, setTrade] = useState<Trade>('plumbing');
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [preferredWindow, setPreferredWindow] = useState('ASAP');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!shop) {
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      demo.createPublicRequest(shopSlug, {
        trade,
        description,
        contactName,
        contactPhone,
        address,
        preferredWindow,
      });
      setDone(true);
      setError('');
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
          <h1>{shop.name}</h1>
          <p className="muted">Office will confirm your appointment — this is not self-scheduling.</p>
        </div>
        {done ? (
          <p className="badge ok">Request submitted. The office will follow up.</p>
        ) : (
          <form className="stack" onSubmit={onSubmit}>
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
