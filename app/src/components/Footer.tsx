import { Link } from 'react-router-dom';
import { COUNTIES } from '../data/counties';

export function Footer() {
  const onlineCount = COUNTIES.filter((c) => c.format === 'online').length;
  return (
    <footer className="foot" id="disclaimer">
      <div className="foot-inner">
        <div className="foot-brand">
          <h4>Florida Tax Deed Registry</h4>
          <p>An executive directory of every Florida county clerk and tax deed auction platform — verified, organized, and updated.</p>
        </div>
        <div className="foot-col">
          <h5>Coverage</h5>
          <a>{COUNTIES.length} Counties Indexed</a>
          <a>{onlineCount} Online Auctions</a>
          <a>67 Property Appraiser Links</a>
        </div>
        <div className="foot-col">
          <h5>Navigate</h5>
          <Link to="/">Directory</Link>
          <Link to="/upcoming">Upcoming Sales</Link>
          <Link to="/surplus">Surplus Funds</Link>
          <Link to="/statute">Statute §197</Link>
          <Link to="/pricing">Pro Membership</Link>
        </div>
      </div>
      <div className="disclaimer">
        <strong>Important.</strong> County websites, auction platforms, and procedures change without notice. All links and information contained in this directory are provided as a research convenience and should be independently verified with the relevant County Clerk before relying upon them for any bid, transaction, or legal purpose. Nothing in this directory constitutes legal, tax, or investment advice.
      </div>
      <div className="foot-bottom">
        <span>
          © 2026 Florida Tax Deed Registry · <Link to="/terms" style={{ color: 'inherit', borderBottom: '1px solid currentColor' }}>Terms</Link> · <Link to="/privacy" style={{ color: 'inherit', borderBottom: '1px solid currentColor' }}>Privacy</Link>
        </span>
        <span>A Statewide Reference</span>
      </div>
    </footer>
  );
}
