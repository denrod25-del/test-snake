import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import MapPage from "./pages/MapPage";
import Trends from "./pages/Trends";
import RiskFactors from "./pages/RiskFactors";
import Methodology from "./pages/Methodology";
import { incidents } from "./data/incidents";

const navItems = [
  { to: "/", label: "Overview", icon: "▣" },
  { to: "/map", label: "Incident Map", icon: "◉" },
  { to: "/trends", label: "Trends", icon: "▲" },
  { to: "/risk", label: "Risk Factors", icon: "◈" },
  { to: "/methodology", label: "Methodology", icon: "?" },
];

export default function App() {
  const totalIncidents = incidents.length;
  const totalKilled = incidents.reduce((s, i) => s + i.killed, 0);
  const dataRange = (() => {
    const years = incidents.map((i) => new Date(i.date).getUTCFullYear());
    return `${Math.min(...years)}–${Math.max(...years)}`;
  })();

  return (
    <div className="min-h-screen flex bg-hud-bg text-hud-text">
      {/* Sidebar */}
      <aside className="w-60 border-r border-hud-border bg-hud-panel flex flex-col">
        <div className="p-4 border-b border-hud-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-hud-accent animate-pulse" />
            <span className="text-xs uppercase tracking-widest text-hud-dim font-mono">
              Live Tracker
            </span>
          </div>
          <h1 className="mt-2 text-lg font-bold tracking-tight leading-tight">
            US School Shootings
          </h1>
          <p className="text-xs text-hud-dim mt-1 font-mono">
            Data Range: {dataRange}
          </p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link-active" : ""}`
              }
            >
              <span className="font-mono text-hud-dim w-4">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-hud-border space-y-2">
          <div className="hud-stat-label">Documented Incidents</div>
          <div className="font-mono text-2xl font-bold">{totalIncidents}</div>
          <div className="hud-stat-label">Lives Lost</div>
          <div className="font-mono text-xl font-bold text-hud-accent">
            {totalKilled}
          </div>
          <p className="text-[10px] text-hud-dim leading-snug pt-2 border-t border-hud-border">
            Curated subset, not exhaustive. See Methodology.
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/risk" element={<RiskFactors />} />
          <Route path="/methodology" element={<Methodology />} />
        </Routes>
      </main>
    </div>
  );
}
