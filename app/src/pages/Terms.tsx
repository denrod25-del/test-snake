import { Link } from 'react-router-dom';

export function Terms() {
  return (
    <main className="legal-wrap">
      <Link className="back-link" to="/">← Back to Registry</Link>
      <div className="eyebrow">Legal</div>
      <h1>Terms of Service</h1>
      <p style={{ fontSize: 17, color: '#4a4a4a' }}>By using Florida Tax Deed Registry, you agree to these Terms. Please read them carefully.</p>
      <div className="stamp"><strong>Effective date:</strong> April 18, 2026 · <strong>Last updated:</strong> April 18, 2026</div>

      <div className="toc-box">
        <h4>Contents</h4>
        <ol>
          <li><a href="#agreement">The agreement</a></li>
          <li><a href="#nolegal">Not legal, financial, or investment advice</a></li>
          <li><a href="#account">Your account</a></li>
          <li><a href="#sub">Subscriptions, billing, refunds</a></li>
          <li><a href="#use">Acceptable use</a></li>
          <li><a href="#data">Data accuracy and verification</a></li>
          <li><a href="#ip">Intellectual property</a></li>
          <li><a href="#third">Third-party links and services</a></li>
          <li><a href="#term">Term and termination</a></li>
          <li><a href="#disclaimer">Disclaimers</a></li>
          <li><a href="#liability">Limitation of liability</a></li>
          <li><a href="#indemnify">Indemnification</a></li>
          <li><a href="#law">Governing law and disputes</a></li>
          <li><a href="#changes">Changes to these Terms</a></li>
          <li><a href="#contact">Contact</a></li>
        </ol>
      </div>

      <h2 id="agreement">1. The agreement</h2>
      <p>These Terms of Service ("Terms") form a binding agreement between you and Florida Tax Deed Registry. By creating an account, subscribing, or using the website, you agree to these Terms. If you do not agree, do not use the service.</p>

      <h2 id="nolegal">2. Not legal, financial, or investment advice</h2>
      <div className="callout">
        <strong>Important</strong>
        Florida Tax Deed Registry provides reference information about tax deed sales in Florida. <strong>We are not a law firm, an accounting firm, or a registered investment adviser.</strong> Nothing on this site constitutes legal, tax, financial, or investment advice. Tax deed investing carries substantial financial and legal risk — including total loss of your bid amount. Always consult licensed Florida counsel and conduct independent due diligence before bidding on any property.
      </div>

      <h2 id="account">3. Your account</h2>
      <ul>
        <li>You must be at least 18 years old to create an account.</li>
        <li>You are responsible for keeping your password confidential.</li>
        <li>You are responsible for all activity under your account.</li>
        <li>One account per person; do not share accounts.</li>
      </ul>

      <h2 id="sub">4. Subscriptions, billing, refunds</h2>
      <p><strong>Pricing.</strong> The Pro subscription is billed monthly at the price shown on our pricing page at the time of purchase. We may change pricing for new subscribers at any time, but we'll give existing subscribers at least 30 days' notice.</p>
      <p><strong>Billing.</strong> Subscriptions are billed in advance each month through Stripe.</p>
      <p><strong>Cancellation.</strong> Cancel anytime from the Account page. Cancellation takes effect at the end of the current billing period.</p>
      <p><strong>Refund policy.</strong> Full refund within 7 days of your initial subscription, no questions asked. After 7 days, payments are non-refundable; we don't pro-rate partial months.</p>
      <p><strong>Failed payments.</strong> If a recurring payment fails, your Pro access may be suspended after a few automatic retries.</p>
      <p><strong>Taxes.</strong> Prices do not include sales tax. Where required, applicable taxes will be added at checkout.</p>

      <h2 id="use">5. Acceptable use</h2>
      <p>You agree NOT to:</p>
      <ul>
        <li>Use automated tools to scrape, crawl, or harvest data beyond what a normal browser would do.</li>
        <li>Resell, sublicense, or redistribute Pro features or data to non-subscribers.</li>
        <li>Reverse-engineer or attempt to circumvent the paywall or any access controls.</li>
        <li>Upload material that infringes anyone's intellectual property, privacy, or other rights.</li>
        <li>Use the service to harass, defraud, or harm any other person.</li>
        <li>Interfere with the operation of the service.</li>
        <li>Misrepresent your identity or affiliation.</li>
        <li>Use the service in violation of any applicable law or regulation.</li>
      </ul>

      <h2 id="data">6. Data accuracy and verification</h2>
      <p>We strive to maintain accurate, current information about Florida tax deed sales, county Clerk pages, surplus funds, and statutory references, but we make <strong>no warranty as to accuracy, completeness, or timeliness</strong>. County websites change without notice. Sale dates, parcel lists, opening bids, and surplus claim deadlines must be independently verified with the County Clerk's office before you take any action in reliance on them.</p>

      <h2 id="ip">7. Intellectual property</h2>
      <p>The website design, code, text, statutory summaries, and aggregated data compilations are owned by us or our licensors. We grant you a limited, revocable, non-exclusive, non-transferable license to use the service for your personal or internal business research purposes. Underlying tax deed records, court documents, and statutory text are public records and are not our property. You retain ownership of content you upload (notes, watchlist entries) and grant us a limited license to store and display it as needed to operate the service.</p>

      <h2 id="third">8. Third-party links and services</h2>
      <p>The service contains links to third-party websites (county Clerk pages, auction platforms, the Florida Senate website) and integrates with third-party providers (Supabase, Stripe). We are not responsible for the content, privacy practices, or availability of third-party sites or services.</p>

      <h2 id="term">9. Term and termination</h2>
      <p>These Terms remain in effect while you use the service. We may suspend or terminate your account at any time for breach of these Terms or for fraud, abuse, or unlawful activity. You may terminate your account anytime from the Account page.</p>

      <h2 id="disclaimer">10. Disclaimers</h2>
      <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>

      <h2 id="liability">11. Limitation of liability</h2>
      <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. OUR AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE GREATER OF (A) ONE HUNDRED U.S. DOLLARS ($100) OR (B) THE TOTAL AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO LIABILITY.</p>

      <h2 id="indemnify">12. Indemnification</h2>
      <p>You agree to defend, indemnify, and hold us harmless from any claims arising out of your violation of these Terms or your use of the service.</p>

      <h2 id="law">13. Governing law and disputes</h2>
      <p>These Terms are governed by the laws of the State of Florida. Any dispute shall be brought exclusively in the state or federal courts located in [your county], Florida. Any claim must be brought in an individual capacity, not as a class member.</p>

      <h2 id="changes">14. Changes to these Terms</h2>
      <p>We may update these Terms from time to time. Material changes will be communicated to active subscribers by email at least 14 days before they take effect.</p>

      <h2 id="contact">15. Contact</h2>
      <p><strong>Florida Tax Deed Registry</strong><br />Email: <a href="mailto:legal@example.com">legal@example.com</a><br />Mail: [Your business mailing address]</p>
    </main>
  );
}
