import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import * as demo from '../lib/demo-store';

export function LoginPage() {
  const { user, loginDemo, signupShop, demoMode } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('owner@dogfood.local');
  const [shopName, setShopName] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  if (user) return <Navigate to="/app" replace />;

  function onLogin(e: FormEvent) {
    e.preventDefault();
    loginDemo(email.trim());
    navigate('/app');
  }

  function onSignup(e: FormEvent) {
    e.preventDefault();
    signupShop(shopName.trim(), slug.trim(), email.trim());
    navigate('/app');
  }

  return (
    <div className="hero-login">
      <div className="hero-card stack">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            Home-services ops
          </p>
          <h1>Field Service Ops</h1>
          <p className="muted">Book → dispatch → finish → get paid on-site.</p>
        </div>
        {!demoMode && (
          <p className="muted">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to use live
            auth. Demo mode is active when those are missing.
          </p>
        )}
        <div className="nav">
          <button type="button" className={mode === 'login' ? '' : 'secondary'} onClick={() => setMode('login')}>
            Log in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? '' : 'secondary'}
            onClick={() => setMode('signup')}
          >
            New shop
          </button>
        </div>
        {mode === 'login' ? (
          <form className="stack" onSubmit={onLogin}>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <p className="muted">
              Demo shortcuts: <code>owner@dogfood.local</code>, <code>tech@dogfood.local</code>
            </p>
            <button type="submit">Enter shop</button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                demo.resetDemo();
                loginDemo('owner@dogfood.local');
                navigate('/app');
              }}
            >
              Reset demo data
            </button>
          </form>
        ) : (
          <form className="stack" onSubmit={onSignup}>
            <label>
              Shop name
              <input value={shopName} onChange={(e) => setShopName(e.target.value)} required />
            </label>
            <label>
              Public slug
              <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="acme-plumbing" />
            </label>
            <label>
              Owner email
              <input value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <button type="submit">Create shop</button>
          </form>
        )}
        <p className="muted">
          Public request form example:{' '}
          <Link to="/r/dogfood">/r/dogfood</Link>
        </p>
      </div>
    </div>
  );
}
