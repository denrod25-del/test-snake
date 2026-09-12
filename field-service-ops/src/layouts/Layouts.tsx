import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function OfficeLayout() {
  const { shop, demoMode, logout, user } = useAuth();
  return (
    <div className="shell">
      {demoMode && (
        <div className="demo-banner">
          Demo mode — data stays in this browser. Configure Supabase env vars for production.
        </div>
      )}
      <header className="topbar">
        <NavLink to="/app" className="brand">
          Field Service Ops
        </NavLink>
        <nav className="nav">
          <NavLink to="/app">Today</NavLink>
          <NavLink to="/app/book">Book</NavLink>
          <NavLink to="/app/requests">Requests</NavLink>
          <NavLink to="/app/dispatch">Dispatch</NavLink>
          <NavLink to="/app/pricebook">Pricebook</NavLink>
          <NavLink to="/app/money">Money</NavLink>
          <NavLink to="/app/team">Team</NavLink>
          <NavLink to="/tech">Tech</NavLink>
        </nav>
      </header>
      <p className="muted" style={{ marginTop: '-0.75rem' }}>
        {shop?.name || 'No shop'} · {user?.email}{' '}
        <button type="button" className="secondary" onClick={logout} style={{ marginLeft: 8 }}>
          Log out
        </button>
      </p>
      <Outlet />
    </div>
  );
}

export function TechLayout() {
  const { shop, logout } = useAuth();
  return (
    <div className="tech-shell">
      <header className="topbar">
        <NavLink to="/tech" className="brand">
          Field Service Ops
        </NavLink>
        <nav className="nav">
          <NavLink to="/tech">My jobs</NavLink>
          <NavLink to="/app">Office</NavLink>
          <button type="button" className="secondary" onClick={logout}>
            Log out
          </button>
        </nav>
      </header>
      <p className="muted">{shop?.name} · tech view</p>
      <Outlet />
    </div>
  );
}
