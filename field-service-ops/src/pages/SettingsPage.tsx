import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { apiPost } from '../lib/api';
import * as demo from '../lib/demo-store';

export function SettingsPage() {
  const { shop, user, membership, accessToken, demoMode, refresh } = useAuth();
  const [spiKey, setSpiKey] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!shop || !user) return null;
  if (!membership?.isOwner) {
    return (
      <section className="panel">
        <h2>Settings</h2>
        <p className="muted">Only shop owners can manage Connect and SPI keys.</p>
      </section>
    );
  }

  async function enableConnect() {
    setBusy(true);
    setMsg('');
    try {
      if (demoMode) {
        demo.enableConnect(shop!.id, user!.id);
        setMsg('Demo Connect enabled.');
        refresh();
        return;
      }
      const res = await apiPost<{ url?: string; demo?: boolean; message?: string }>(
        '/api/create-connect-account',
        { shopId: shop!.id },
        accessToken,
      );
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      setMsg(res.message || 'Connect response received.');
      refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Connect failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveSpi(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      if (demoMode) {
        demo.setSpiConfigured(shop!.id, user!.id, true);
        setMsg('Demo SPI marked configured (key not sent).');
        setSpiKey('');
        refresh();
        return;
      }
      await apiPost('/api/set-spi-key', { shopId: shop!.id, spiKey }, accessToken);
      setMsg('SPI key stored (encrypted server-side).');
      setSpiKey('');
      refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid two">
      <section className="panel">
        <h2>Stripe Connect</h2>
        <p className="muted">Payouts go to your Express connected account.</p>
        <p>
          Status:{' '}
          {shop.stripeConnectAccountId ? (
            <span className="badge ok">linked ({shop.stripeConnectAccountId})</span>
          ) : (
            <span className="badge warn">not linked</span>
          )}
        </p>
        <button type="button" disabled={busy} onClick={() => void enableConnect()}>
          {shop.stripeConnectAccountId ? 'Resume / refresh onboarding' : 'Start Connect onboarding'}
        </button>
      </section>
      <section className="panel">
        <h2>Property briefing (SPI)</h2>
        <p className="muted">
          Paste a DeedScout shop API key. It is encrypted at rest and never shown again.
        </p>
        <form className="stack" onSubmit={(e) => void saveSpi(e)}>
          <label>
            SPI API key
            <input
              type="password"
              value={spiKey}
              onChange={(e) => setSpiKey(e.target.value)}
              placeholder="ds_shop_…"
              required={!demoMode}
            />
          </label>
          <button type="submit" disabled={busy}>
            Save SPI key
          </button>
        </form>
      </section>
      {msg && (
        <section className="panel" style={{ gridColumn: '1 / -1' }}>
          <p className="muted">{msg}</p>
        </section>
      )}
    </div>
  );
}
