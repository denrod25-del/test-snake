import { useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
} from "react-leaflet";
import PageHeader from "../components/PageHeader";
import Panel from "../components/Panel";
import { incidents, type IncidentCategory } from "../data/incidents";

const categoryColors: Record<IncidentCategory, string> = {
  mass: "#ff5d5d",
  targeted: "#ffb547",
  indiscriminate: "#ff7eb6",
  altercation: "#5db5ff",
  accidental: "#5dd2a3",
  suicide: "#b67cff",
  officer: "#cdd6e4",
  other: "#6b7689",
};

const categories: IncidentCategory[] = [
  "mass",
  "indiscriminate",
  "targeted",
  "altercation",
  "suicide",
  "accidental",
  "officer",
  "other",
];

export default function MapPage() {
  const [activeCats, setActiveCats] = useState<Set<IncidentCategory>>(
    new Set(categories)
  );
  const [minYear, setMinYear] = useState(1990);

  const filtered = useMemo(
    () =>
      incidents.filter(
        (i) =>
          activeCats.has(i.category) &&
          new Date(i.date).getUTCFullYear() >= minYear
      ),
    [activeCats, minYear]
  );

  const toggle = (c: IncidentCategory) => {
    const next = new Set(activeCats);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setActiveCats(next);
  };

  return (
    <div className="min-h-full">
      <PageHeader
        title="Incident Map"
        subtitle="Geographic distribution of documented incidents. Marker size = casualties (killed + wounded)."
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Panel title="Filters">
          <div className="space-y-4">
            <div>
              <div className="hud-stat-label mb-2">Earliest Year</div>
              <input
                type="range"
                min={1990}
                max={2025}
                value={minYear}
                onChange={(e) => setMinYear(Number(e.target.value))}
                className="w-full accent-hud-accent"
              />
              <div className="text-xs font-mono text-hud-dim mt-1">
                {minYear} → 2025
              </div>
            </div>
            <div>
              <div className="hud-stat-label mb-2">Categories</div>
              <ul className="space-y-1">
                {categories.map((c) => (
                  <li key={c}>
                    <label className="flex items-center gap-2 text-xs cursor-pointer hover:text-hud-text">
                      <input
                        type="checkbox"
                        checked={activeCats.has(c)}
                        onChange={() => toggle(c)}
                        className="accent-hud-accent"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: categoryColors[c] }}
                      />
                      <span className="capitalize">{c}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div className="pt-3 border-t border-hud-border">
              <div className="hud-stat-label">Showing</div>
              <div className="text-xl font-mono font-bold">
                {filtered.length}
                <span className="text-xs text-hud-dim ml-2">
                  / {incidents.length}
                </span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Geographic View" className="lg:col-span-3 p-0">
          <div className="h-[600px]">
            <MapContainer
              center={[39.5, -98.35]}
              zoom={4}
              scrollWheelZoom={true}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              {filtered.map((i) => {
                const total = i.killed + i.wounded;
                const radius = Math.max(5, Math.min(28, 4 + Math.sqrt(total) * 3));
                return (
                  <CircleMarker
                    key={i.id}
                    center={[i.lat, i.lng]}
                    radius={radius}
                    pathOptions={{
                      color: categoryColors[i.category],
                      fillColor: categoryColors[i.category],
                      fillOpacity: 0.45,
                      weight: 1.5,
                    }}
                  >
                    <Popup>
                      <div className="font-sans">
                        <div className="font-semibold text-sm">{i.school}</div>
                        <div className="text-xs text-hud-dim">
                          {i.city}, {i.state} · {i.date}
                        </div>
                        <div className="mt-2 text-xs">
                          <span className="text-hud-accent font-bold">
                            {i.killed} killed
                          </span>
                          {" · "}
                          <span className="text-hud-info font-bold">
                            {i.wounded} wounded
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-widest text-hud-dim">
                          {i.category} · {i.level}
                        </div>
                        {i.notes && (
                          <div className="mt-2 text-xs italic">{i.notes}</div>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
