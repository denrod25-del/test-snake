import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useShopData } from '../data/ShopDataContext';

export function DispatchBoardPage() {
  const { shop, user } = useAuth();
  const { jobs, members, assignJob } = useShopData();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  if (!shop || !user) return null;
  const techs = members.filter((m) => m.isTech);

  return (
    <section className="panel">
      <h2>Dispatch board</h2>
      <label>
        Day
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <table className="table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Window</th>
            <th>Status</th>
            <th>Assign</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>
                <strong>{j.trade}</strong> · {j.address}
                <div className="muted">{j.description}</div>
                <Link to={`/app/jobs/${j.id}`}>Open</Link>
              </td>
              <td>{j.preferredWindow}</td>
              <td>
                <span className="badge">{j.status}</span>
              </td>
              <td>
                <select
                  value={j.techUserId || ''}
                  onChange={(e) => {
                    const tech = e.target.value;
                    if (!tech) return;
                    void assignJob(j.id, tech, date);
                  }}
                >
                  <option value="">Unassigned</option>
                  {techs.map((t) => (
                    <option key={t.userId} value={t.userId}>
                      {t.email}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {jobs.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No jobs to dispatch.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
