import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useShopData } from '../data/ShopDataContext';
import type { Trade } from '../lib/types';

export function BookJobPage() {
  const { shop, user } = useAuth();
  const { customers, createCustomer, createJob } = useShopData();
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });
  const [trade, setTrade] = useState<Trade>('plumbing');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [windowPref, setWindowPref] = useState('Tomorrow AM');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (!shop || !user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      let cid = customerId || null;
      if (!cid) {
        const c = await createCustomer(newCustomer);
        cid = c.id;
      }
      const cust = customers.find((c) => c.id === cid);
      await createJob({
        customerId: cid,
        trade,
        description,
        address: address || cust?.address || newCustomer.address || '',
        preferredWindow: windowPref,
      });
      setMessage('Job created as unassigned — assign it on Dispatch.');
      setDescription('');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to book');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Book a job</h2>
      <form className="stack" onSubmit={(e) => void onSubmit(e)}>
        <label>
          Existing customer
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— create new —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone})
              </option>
            ))}
          </select>
        </label>
        {!customerId && (
          <div className="grid two">
            <label>
              Name
              <input
                required
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              />
            </label>
            <label>
              Phone
              <input
                required
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              />
            </label>
            <label>
              Email
              <input
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              />
            </label>
            <label>
              Address
              <input
                required
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
              />
            </label>
          </div>
        )}
        <label>
          Trade
          <select value={trade} onChange={(e) => setTrade(e.target.value as Trade)}>
            <option value="plumbing">Plumbing</option>
            <option value="hvac">HVAC</option>
            <option value="electrical">Electrical</option>
          </select>
        </label>
        <label>
          Issue
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Service address
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Defaults to customer address"
          />
        </label>
        <label>
          Preferred window
          <input value={windowPref} onChange={(e) => setWindowPref(e.target.value)} />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Create job'}
        </button>
        {message && <p className="muted">{message}</p>}
      </form>
    </section>
  );
}
