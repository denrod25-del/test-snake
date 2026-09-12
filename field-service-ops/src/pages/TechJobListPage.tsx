import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import * as demo from '../lib/demo-store';

export function TechJobListPage() {
  const { shop, user } = useAuth();
  if (!shop || !user) return null;
  const jobs = demo
    .getState()
    .jobs.filter((j) => j.shopId === shop.id && j.techUserId === user.id);

  return (
    <section className="panel">
      <h2>My jobs</h2>
      <div className="stack">
        {jobs.map((j) => (
          <Link key={j.id} to={`/tech/jobs/${j.id}`} className="panel" style={{ margin: 0 }}>
            <strong>
              {j.trade} · {j.status}
            </strong>
            <div className="muted">{j.address}</div>
            <div>{j.description}</div>
          </Link>
        ))}
        {jobs.length === 0 && <p className="muted">No jobs assigned to you.</p>}
      </div>
    </section>
  );
}
