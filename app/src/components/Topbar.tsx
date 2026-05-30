import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAuthModal } from './AuthModal';
import { CONFIG } from '../lib/config';

export function Topbar() {
  const { user, profile, isPro, signOut } = useAuth();
  const { open } = useAuthModal();

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <span>Florida Statewide Coverage — All 67 Counties</span>
        <span className="topbar-right">
          <span>{CONFIG.AUTH_ENABLED ? 'Live data feed enabled' : 'Demo mode · configure auth in .env.local'}</span>
          <span className="topbar-divider">|</span>
          {user ? (
            <span className="account-pill">
              <span className="account-avatar">{(profile?.full_name ?? user.email ?? '?')[0].toUpperCase()}</span>
              <span className="account-name"><Link to="/account">{user.email}</Link></span>
              {isPro && <span className="pro-tag">PRO</span>}
              <a className="signout-link" onClick={() => void signOut()}>Sign out</a>
            </span>
          ) : (
            <a onClick={() => open('signin')} style={{ cursor: 'pointer' }}>Sign In</a>
          )}
        </span>
      </div>
    </div>
  );
}
