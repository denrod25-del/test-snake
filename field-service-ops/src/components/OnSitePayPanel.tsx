import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { apiPost } from '../lib/api';
import { formatUsd } from '../lib/invoice';

const stripeCache = new Map<string, Promise<Stripe | null>>();

function getStripe(publishableKey: string, stripeAccount?: string | null) {
  const key = `${publishableKey}:${stripeAccount || ''}`;
  if (!stripeCache.has(key)) {
    stripeCache.set(
      key,
      loadStripe(publishableKey, stripeAccount ? { stripeAccount } : undefined),
    );
  }
  return stripeCache.get(key)!;
}

function PayForm({
  amountCents,
  onPaid,
  onError,
}: {
  amountCents: number;
  onPaid: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}`,
        },
      });
      if (result.error) {
        onError(result.error.message || 'Payment failed');
        return;
      }
      const status = result.paymentIntent?.status;
      if (status === 'succeeded' || status === 'processing') {
        onPaid();
      } else {
        onError(`Unexpected status: ${status || 'unknown'}`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={(e) => void onSubmit(e)}>
      <PaymentElement />
      <button type="submit" disabled={!stripe || busy}>
        {busy ? 'Processing…' : `Pay ${formatUsd(amountCents)}`}
      </button>
    </form>
  );
}

export function OnSitePayPanel({
  shopId,
  jobId,
  invoiceId,
  amountCents,
  accessToken,
  demoMode,
  disabled,
  onDemoCollect,
  onLivePaid,
}: {
  shopId: string;
  jobId: string;
  invoiceId: string | null;
  amountCents: number;
  accessToken: string | null;
  demoMode: boolean;
  disabled: boolean;
  onDemoCollect: (succeed: boolean) => Promise<void>;
  onLivePaid: () => void;
}) {
  const [msg, setMsg] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [stripeAccount, setStripeAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stripePromise = useMemo(() => {
    if (!publishableKey) return null;
    return getStripe(publishableKey, stripeAccount);
  }, [publishableKey, stripeAccount]);

  useEffect(() => {
    setClientSecret(null);
    setMsg('');
  }, [invoiceId, amountCents]);

  async function startLiveIntent() {
    if (!invoiceId || !accessToken) {
      setMsg('Missing invoice or session.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await apiPost<{
        clientSecret?: string;
        demo?: boolean;
        stripeAccount?: string;
        publishableKey?: string | null;
        paymentIntentId?: string;
      }>(
        '/api/create-payment-intent',
        { shopId, invoiceId, jobId, amountCents },
        accessToken,
      );
      if (res.demo || !res.clientSecret || res.clientSecret === 'pi_demo_secret') {
        setMsg('Server returned demo PI — configure Stripe keys on Netlify for live collect.');
        return;
      }
      const pk =
        res.publishableKey ||
        (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ||
        null;
      if (!pk) {
        setMsg('Missing Stripe publishable key (response or VITE_STRIPE_PUBLISHABLE_KEY).');
        return;
      }
      setPublishableKey(pk);
      setStripeAccount(res.stripeAccount || null);
      setClientSecret(res.clientSecret);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not start payment');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>On-site pay</h2>
      <p className="muted">
        {demoMode
          ? 'Demo Payment Element stand-in. Production mounts Stripe Payment Element on the connected account.'
          : 'Collect card/ACH on-site via Stripe Payment Element (direct charge on your Connect account).'}
      </p>
      <p>
        Amount due {formatUsd(amountCents)}
      </p>
      {demoMode ? (
        <div className="status-row">
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                setMsg('');
                try {
                  await onDemoCollect(true);
                  setMsg('Payment collected (demo).');
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : 'Pay failed');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Collect card (demo success)
          </button>
          <button
            type="button"
            className="secondary"
            disabled={disabled || busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  await onDemoCollect(false);
                  setMsg('Payment failed (demo).');
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : 'Pay failed');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Simulate failure
          </button>
        </div>
      ) : clientSecret && stripePromise ? (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: { theme: 'stripe' },
          }}
        >
          <PayForm
            amountCents={amountCents}
            onPaid={() => {
              setMsg('Payment submitted. Status updates when the webhook confirms.');
              setClientSecret(null);
              onLivePaid();
            }}
            onError={setMsg}
          />
        </Elements>
      ) : (
        <button type="button" disabled={disabled || busy || amountCents <= 0} onClick={() => void startLiveIntent()}>
          {busy ? 'Starting…' : 'Start on-site payment'}
        </button>
      )}
      {msg && <p className="muted">{msg}</p>}
    </section>
  );
}
