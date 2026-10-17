import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useShopData } from '../data/ShopDataContext';
import { formatUsd } from '../lib/invoice';
import type { Trade } from '../lib/types';

export function PricebookPage() {
  const { shop, user } = useAuth();
  const { pricebook, upsertPricebookItem } = useShopData();
  const [name, setName] = useState('');
  const [trade, setTrade] = useState<Trade>('plumbing');
  const [amount, setAmount] = useState('89');

  if (!shop || !user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await upsertPricebookItem({
      name,
      trade,
      unitAmountCents: Math.round(parseFloat(amount) * 100),
    });
    setName('');
  }

  return (
    <section className="panel">
      <h2>Pricebook</h2>
      <form className="grid two" onSubmit={(e) => void onSubmit(e)}>
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
          {pricebook.map((i) => (
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
