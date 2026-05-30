import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthModal } from '../components/AuthModal';
import { fmtDate } from '../lib/helpers';

export function Account() {
  const [search] = useSearchParams();
  const success = search.get('checkout') === 'success';
  const { user, profile, isPro, signOut, openBillingPortal } = useAuth();
  const { open } = useAuthModal();

  if (!user) {
    return (
      <main className="detail-inner">
        <Link className="back-link" to="/">← Back to Registry</Link>
        <h1 className="detail-title">Account</h1>
        <p className="lede">You need to <a onClick={() => open('signin')} style={{ cursor: 'pointer', color: 'var(--accent-ink)', borderBottom: '1px solid' }}>sign in</a> to view your account.</p>
      </main>
    );
  }

  return (
    <main className="detail-inner">
      <Link className="back-link" to="/">← Back to Registry</Link>
      <div className="detail-head">
        <div>
          <div className="eyebrow">Account</div>
          <h1 className="detail-title">{profile?.full_name || user.email}</h1>
          <p className="lede">Manage your subscription, billing, and account preferences.</p>
        </div>
        <div className="detail-meta">
          <div className="meta-row"><span className="meta-lbl">Email</span><span className="meta-val">{user.email}</span></div>
          <div className="meta-row"><span className="meta-lbl">Plan</span><span className="meta-val">{isPro ? 'Pro' : 'Free'}</span></div>
          <div className="meta-row"><span className="meta-lbl">Status</span><span className="meta-val">{profile?.subscription_status ?? 'free'}</span></div>
          {profile?.current_period_end && (
            <div className="meta-row"><span className="meta-lbl">Renews</span><span className="meta-val">{fmtDate(profile.current_period_end.slice(0, 10))}</span></div>
          )}
        </div>
      </div>

      {success && <div className="pricing-notice success">Welcome to Pro! Your subscription is active. Visit your billing portal anytime to manage payment details.</div>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {isPro ? (
          <button className="btn-primary" onClick={() => void openBillingPortal()}>Manage billing</button>
        ) : (
          <Link to="/pricing" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Upgrade to Pro</Link>
        )}
        <button className="btn-secondary" onClick={() => void signOut()}>Sign out</button>
      </div>
    </main>
  );
}
