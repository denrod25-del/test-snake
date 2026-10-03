import { useState } from 'react';
import { formatUsd, invoiceTotalCents } from '../lib/invoice';
import type { InvoiceLine, PricebookItem } from '../lib/types';

function uid(): string {
  return `line_${Math.random().toString(36).slice(2, 9)}`;
}

export function InvoiceBuilder({
  pricebook,
  lines,
  onSave,
}: {
  pricebook: PricebookItem[];
  lines: InvoiceLine[];
  onSave: (lines: InvoiceLine[]) => void;
}) {
  const [draft, setDraft] = useState<InvoiceLine[]>(lines);
  const [custom, setCustom] = useState({ description: '', amount: '' });

  function addPricebook(item: PricebookItem) {
    setDraft((d) => [
      ...d,
      {
        id: uid(),
        description: item.name,
        quantity: 1,
        unitAmountCents: item.unitAmountCents,
      },
    ]);
  }

  function addCustom() {
    const cents = Math.round(parseFloat(custom.amount || '0') * 100);
    if (!custom.description || !cents) return;
    setDraft((d) => [
      ...d,
      { id: uid(), description: custom.description, quantity: 1, unitAmountCents: cents },
    ]);
    setCustom({ description: '', amount: '' });
  }

  return (
    <section className="panel">
      <h2>Invoice</h2>
      <div className="status-row" style={{ marginBottom: '0.75rem' }}>
        {pricebook.map((p) => (
          <button key={p.id} type="button" className="secondary" onClick={() => addPricebook(p)}>
            + {p.name} ({formatUsd(p.unitAmountCents)})
          </button>
        ))}
      </div>
      <div className="grid two">
        <label>
          Custom line
          <input
            value={custom.description}
            onChange={(e) => setCustom({ ...custom, description: e.target.value })}
            placeholder="Description"
          />
        </label>
        <label>
          Amount (USD)
          <input
            value={custom.amount}
            onChange={(e) => setCustom({ ...custom, amount: e.target.value })}
            placeholder="49.00"
          />
        </label>
      </div>
      <button type="button" className="secondary" onClick={addCustom}>
        Add custom line
      </button>
      <table className="table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {draft.map((l) => (
            <tr key={l.id}>
              <td>{l.description}</td>
              <td>{l.quantity}</td>
              <td>{formatUsd(l.unitAmountCents * l.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>Total {formatUsd(invoiceTotalCents(draft))}</strong>
      </p>
      <button type="button" onClick={() => onSave(draft)}>
        Save invoice
      </button>
    </section>
  );
}
