import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'signin' | 'signup';
interface ModalState {
  isOpen: boolean;
  tab: Tab;
  open: (tab?: Tab) => void;
  close: () => void;
  switchTab: (tab: Tab) => void;
}
const ModalContext = createContext<ModalState | undefined>(undefined);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('signin');
  const value: ModalState = {
    isOpen, tab,
    open: (t) => { if (t) setTab(t); setIsOpen(true); },
    close: () => setIsOpen(false),
    switchTab: setTab,
  };
  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useAuthModal(): ModalState {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider');
  return ctx;
}

export function AuthModal() {
  const { isOpen, tab, close, switchTab } = useAuthModal();
  const { signIn, signUp } = useAuth();

  const [signinErr, setSigninErr] = useState<string | null>(null);
  const [signupErr, setSignupErr] = useState<string | null>(null);
  const [signupOk, setSignupOk]   = useState<string | null>(null);
  const [busy, setBusy]           = useState(false);

  useEffect(() => {
    if (isOpen) { setSigninErr(null); setSignupErr(null); setSignupOk(null); }
  }, [isOpen]);

  if (!isOpen) return null;

  const onSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setSigninErr(null);
    const f = e.currentTarget;
    const email    = (f.elements.namedItem('email')    as HTMLInputElement).value;
    const password = (f.elements.namedItem('password') as HTMLInputElement).value;
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setSigninErr(error); else close();
  };

  const onSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setSignupErr(null); setSignupOk(null);
    const f = e.currentTarget;
    const fullName = (f.elements.namedItem('full_name') as HTMLInputElement).value;
    const email    = (f.elements.namedItem('email')     as HTMLInputElement).value;
    const password = (f.elements.namedItem('password')  as HTMLInputElement).value;
    const { error, needsConfirm } = await signUp(email, password, fullName);
    setBusy(false);
    if (error) { setSignupErr(error); return; }
    if (needsConfirm) setSignupOk(`Check your inbox. We sent a confirmation email to ${email}.`);
    else close();
  };

  return (
    <div className="auth-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="auth-modal">
        <button className="auth-close" onClick={close} aria-label="Close">×</button>
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => switchTab('signin')}>Sign In</button>
          <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => switchTab('signup')}>Create Account</button>
        </div>

        {tab === 'signin' ? (
          <form className="auth-form" onSubmit={onSignIn}>
            <h2 className="auth-title">Welcome back</h2>
            <p className="auth-sub">Sign in to access your watchlists and Pro features.</p>
            <label className="form-field">
              <span className="form-lbl">Email</span>
              <input type="email" name="email" required autoComplete="email" />
            </label>
            <label className="form-field">
              <span className="form-lbl">Password</span>
              <input type="password" name="password" required autoComplete="current-password" />
            </label>
            <button type="submit" className="btn-primary auth-submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
            <p className="auth-foot"><a onClick={() => switchTab('signup')}>Don't have an account? Create one →</a></p>
            {signinErr && <div className="auth-error">{signinErr}</div>}
          </form>
        ) : (
          <form className="auth-form" onSubmit={onSignUp}>
            <h2 className="auth-title">Create your account</h2>
            <p className="auth-sub">Free forever. Upgrade to Pro for unlimited watchlists and alerts.</p>
            <label className="form-field">
              <span className="form-lbl">Full Name</span>
              <input type="text" name="full_name" required autoComplete="name" />
            </label>
            <label className="form-field">
              <span className="form-lbl">Email</span>
              <input type="email" name="email" required autoComplete="email" />
            </label>
            <label className="form-field">
              <span className="form-lbl">Password</span>
              <input type="password" name="password" required autoComplete="new-password" minLength={8} />
              <span className="form-hint">8 characters minimum</span>
            </label>
            <button type="submit" className="btn-primary auth-submit" disabled={busy}>
              {busy ? 'Creating account…' : 'Create Account'}
            </button>
            <p className="auth-foot"><a onClick={() => switchTab('signin')}>Already have an account? Sign in →</a></p>
            {signupErr && <div className="auth-error">{signupErr}</div>}
            {signupOk  && <div className="auth-success"><strong>Check your inbox.</strong> {signupOk}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
