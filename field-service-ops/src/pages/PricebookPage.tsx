import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import * as demo from '../lib/demo-store';
import { formatUsd } from '../lib/invoice';
import type { Trade } from '../lib/types';

export function PricebookPage() {
  const { shop, user, refresh } = useAuth();
  const [name, setName] = useState('');
  const [trade, setTrade] = useState<Trade>('plumbing');
  const [amount, setAmount] = useState('89');

  if (!shop || !user) return null;
  const items = demo.getState().pricebook.filter((p) => p.shopId === shop.id);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    demo.upsertPricebookItem(shop!.id, user!.id, {
      name,
      trade,
      unitAmountCents: Math.round(parseFloat(amount) * 100),
    });
    setName('');
    refresh();
  }

  return (
    <section className="panel">
      <h2>Pricebook</h2>
      <form className="grid two" onSubmit={onSubmit}>
        <label>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Trade
          <select value={trade} onChange={(e) => setTrade(e.target.value as Trade)}>
            <option value="plumbing">Plumbing</option>
            <option value="hvac">HVAC</option>
            <option value="electrical">Electrical</option>
          </select>
        </label>
        <label>
          Price (USD)
          <input required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <div style={{ alignSelf: 'end' }}>
          <button type="submit">Add item</button>
        </div>
      </form>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Trade</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>{i.name}</td>
              <td>{i.trade}</td>
              <td>{formatUsd(i.unitAmountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
