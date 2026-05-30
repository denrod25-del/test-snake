import { Link } from 'react-router-dom';

export function Privacy() {
  return (
    <main className="legal-wrap">
      <Link className="back-link" to="/">← Back to Registry</Link>
      <div className="eyebrow">Legal</div>
      <h1>Privacy Policy</h1>
      <p style={{ fontSize: 17, color: '#4a4a4a' }}>We respect your privacy. This page explains exactly what we collect, why, and how to control it.</p>
      <div className="stamp"><strong>Effective date:</strong> April 18, 2026 · <strong>Last updated:</strong> April 18, 2026</div>

      <div className="toc-box">
        <h4>Contents</h4>
        <ol>
          <li><a href="#who">Who we are</a></li>
          <li><a href="#info">Information we collect</a></li>
          <li><a href="#use">How we use information</a></li>
          <li><a href="#share">When we share information</a></li>
          <li><a href="#cookies">Cookies and local storage</a></li>
          <li><a href="#payments">Payments and billing</a></li>
          <li><a href="#retention">Data retention</a></li>
          <li><a href="#rights">Your rights</a></li>
          <li><a href="#security">Security</a></li>
          <li><a href="#children">Children</a></li>
          <li><a href="#changes">Changes to this policy</a></li>
          <li><a href="#contact">Contact</a></li>
        </ol>
      </div>

      <h2 id="who">1. Who we are</h2>
      <p>Florida Tax Deed Registry ("we", "us", "our") operates this website and the related Pro subscription service. We are headquartered in Florida, USA. For privacy questions, email <a href="mailto:privacy@example.com">privacy@example.com</a>.</p>

      <h2 id="info">2. Information we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li><strong>Account information:</strong> name, email address, password (stored as a salted hash by our auth provider).</li>
        <li><strong>Subscription information:</strong> if you subscribe to Pro, we receive your billing email, plan, subscription status, and renewal date from Stripe. We never see or store your card number.</li>
        <li><strong>Watchlist data:</strong> the parcel IDs, addresses, notes, bid limits, and statuses that you choose to save in your research notebook.</li>
        <li><strong>Alert preferences:</strong> the counties you sign up to receive email alerts about.</li>
        <li><strong>Support messages:</strong> the contents of any email you send us.</li>
      </ul>
      <h3>Information we collect automatically</h3>
      <ul>
        <li><strong>Log data:</strong> IP address, browser type, referrer, and timestamps for each request, retained for up to 30 days for abuse prevention and debugging.</li>
        <li><strong>Aggregate usage:</strong> page views and feature usage in aggregate, with no per-user analytics or third-party tracking pixels.</li>
      </ul>
      <h3>Information we do not collect</h3>
      <p>We do not use Google Analytics, Facebook Pixel, ad networks, or session-replay tools. We do not track you across other websites. We do not sell your information.</p>

      <h2 id="use">3. How we use information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Operate and improve the service.</li>
        <li>Authenticate you and protect your account.</li>
        <li>Process subscription payments and send transactional billing emails.</li>
        <li>Send the per-county email alerts you have opted into.</li>
        <li>Respond to your support requests.</li>
        <li>Investigate suspected fraud, abuse, or violations of our Terms.</li>
        <li>Comply with legal obligations.</li>
      </ul>

      <h2 id="share">4. When we share information</h2>
      <p>We do not sell or rent personal information. We share information only with the following service providers, strictly for the purposes listed:</p>
      <ul>
        <li><strong>Supabase</strong> — database and authentication hosting.</li>
        <li><strong>Stripe</strong> — payment processing for the Pro subscription. <a href="https://stripe.com/privacy" target="_blank" rel="noopener">stripe.com/privacy</a>.</li>
        <li><strong>Netlify</strong> — hosting for the website and serverless functions.</li>
        <li><strong>Email delivery provider</strong> — sending transactional and alert emails.</li>
        <li><strong>Government and law enforcement</strong> — only when legally required by valid subpoena, court order, or comparable process.</li>
      </ul>

      <h2 id="cookies">5. Cookies and local storage</h2>
      <p>We use the minimum necessary set:</p>
      <ul>
        <li>An <strong>authentication session</strong> cookie/token from Supabase, so you stay signed in.</li>
        <li><strong>Browser local storage</strong> for the research notebook on free accounts (the data never leaves your device unless you upgrade to Pro).</li>
        <li>A <strong>preferences cookie</strong> for things like remembered region filters.</li>
      </ul>

      <h2 id="payments">6. Payments and billing</h2>
      <p>All payment processing is handled by <strong>Stripe, Inc.</strong> Card details are submitted directly to Stripe and are never transmitted to or stored on our servers.</p>

      <h2 id="retention">7. Data retention</h2>
      <ul>
        <li><strong>Account data</strong> is retained while your account is active and for 30 days after deletion.</li>
        <li><strong>Billing records</strong> are retained for seven (7) years to comply with tax and accounting obligations.</li>
        <li><strong>Server logs</strong> are retained for up to thirty (30) days.</li>
      </ul>

      <h2 id="rights">8. Your rights</h2>
      <p>Regardless of where you live, you may at any time access, correct, delete, export, or object to processing of your personal data. Email <a href="mailto:privacy@example.com">privacy@example.com</a>; we respond within 30 days. California residents have additional CCPA rights.</p>

      <h2 id="security">9. Security</h2>
      <p>We use TLS encryption, encrypted database storage, hashed passwords, row-level security, and least-privilege staff access. No system is perfectly secure; if we ever experience a breach affecting your data, we will notify affected users without undue delay.</p>

      <h2 id="children">10. Children</h2>
      <p>This service is not directed to children under 13, and we do not knowingly collect personal information from children under 13.</p>

      <h2 id="changes">11. Changes to this policy</h2>
      <p>We may update this policy from time to time. The "Last updated" date will reflect any change. Material changes will be communicated to active subscribers by email at least 14 days before they take effect.</p>

      <h2 id="contact">12. Contact</h2>
      <p><strong>Florida Tax Deed Registry</strong><br />Email: <a href="mailto:privacy@example.com">privacy@example.com</a><br />Mail: [Your business mailing address]</p>
    </main>
  );
}
