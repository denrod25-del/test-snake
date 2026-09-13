import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useShopData } from '../data/ShopDataContext';

export function TechJobListPage() {
  const { shop, user } = useAuth();
  const { jobs } = useShopData();
  if (!shop || !user) return null;
  const mine = jobs.filter((j) => j.techUserId === user.id);

  return (
    <section className="panel">
      <h2>My jobs</h2>
      <div className="stack">
        {mine.map((j) => (
          <Link key={j.id} to={`/tech/jobs/${j.id}`} className="panel" style={{ margin: 0 }}>
            <strong>
              {j.trade} · {j.status}
            </strong>
            <div className="muted">{j.address}</div>
            <div>{j.description}</div>
          </Link>
        ))}
        {mine.length === 0 && <p className="muted">No jobs assigned to you.</p>}
      </div>
    </section>
  );
}
