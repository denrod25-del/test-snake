import { NavLink, Link } from 'react-router-dom';

export function Masthead() {
  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="brand">
          <Link to="/" className="brand-mark" aria-label="Home">F</Link>
          <div className="brand-text">
            <h1>Florida Tax Deed Registry</h1>
            <p>The Statewide Reference for Tax Deed Sales</p>
          </div>
        </div>
        <nav className="primary">
          <NavLink to="/" end>Directory</NavLink>
          <NavLink to="/upcoming">Upcoming</NavLink>
          <NavLink to="/surplus">Surplus</NavLink>
          <NavLink to="/statute">Statute §197</NavLink>
          <NavLink to="/research">Research</NavLink>
          <NavLink to="/pricing" className="nav-pro">Pro</NavLink>
        </nav>
      </div>
    </header>
  );
}
