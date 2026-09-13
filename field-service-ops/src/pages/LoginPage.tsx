import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import * as demo from '../lib/demo-store';

export function LoginPage() {
  const { user, loginDemo, loginLive, signupShop, demoMode, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(demoMode ? 'owner@dogfood.local' : '');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/app" replace />;

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (demoMode) {
        loginDemo(email.trim());
      } else {
        await loginLive(email.trim(), password);
      }
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSignup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signupShop(shopName.trim(), slug.trim(), email.trim(), password);
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setBusy(false);
    }
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
        {demoMode ? (
          <p className="badge warn">Demo mode — no Supabase env configured</p>
        ) : (
          <p className="badge ok">Live Supabase auth</p>
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
          <form className="stack" onSubmit={(e) => void onLogin(e)}>
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            {!demoMode && (
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            )}
            {demoMode && (
              <p className="muted">
                Demo shortcuts: <code>owner@dogfood.local</code>, <code>tech@dogfood.local</code>
              </p>
            )}
            {error && <p className="badge danger">{error}</p>}
            <button type="submit" disabled={busy}>
              Enter shop
            </button>
            {demoMode && (
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
            )}
          </form>
        ) : (
          <form className="stack" onSubmit={(e) => void onSignup(e)}>
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
            {!demoMode && (
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
            )}
            {error && <p className="badge danger">{error}</p>}
            <button type="submit" disabled={busy}>
              Create shop
            </button>
          </form>
        )}
        <p className="muted">
          Public request form example: <Link to="/r/dogfood">/r/dogfood</Link>
        </p>
      </div>
    </div>
  );
}
