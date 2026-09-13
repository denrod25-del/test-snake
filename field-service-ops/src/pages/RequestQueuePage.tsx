import { useAuth } from '../auth/AuthContext';
import { useShopData } from '../data/ShopDataContext';

export function RequestQueuePage() {
  const { shop, user } = useAuth();
  const { requests, confirmRequest, declineRequest } = useShopData();
  if (!shop || !user) return null;

  return (
    <section className="panel">
      <h2>Online requests</h2>
      <p className="muted">
        Customers submit via <code>/r/{shop.slug}</code>. Confirm creates an unassigned job.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Contact</th>
            <th>Trade</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.contactName}</strong>
                <div className="muted">{r.contactPhone}</div>
                <div className="muted">{r.address}</div>
                <div>{r.description}</div>
              </td>
              <td>{r.trade}</td>
              <td>
                <span className="badge">{r.status}</span>
              </td>
              <td>
                {r.status === 'pending' && (
                  <div className="stack">
                    <button type="button" onClick={() => void confirmRequest(r.id)}>
                      Confirm → job
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void declineRequest(r.id)}
                    >
                      Decline
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No requests yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
