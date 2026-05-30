import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "../components/PageHeader";
import Panel from "../components/Panel";
import { incidents } from "../data/incidents";
import { aggregateByState, aggregateByYear, countBy } from "../lib/analytics";

export default function Trends() {
  const yearly = useMemo(() => aggregateByYear(), []);

  const byDecade = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of incidents) {
      const decade = `${Math.floor(new Date(i.date).getUTCFullYear() / 10) * 10}s`;
      m.set(decade, (m.get(decade) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const stateRanking = useMemo(
    () =>
      aggregateByState()
        .filter((s) => s.incidentCount > 0)
        .sort((a, b) => b.incidentCount - a.incidentCount),
    []
  );

  const byShooterAge = useMemo(() => {
    const buckets = [
      { name: "<13", min: 0, max: 12, value: 0 },
      { name: "13-15", min: 13, max: 15, value: 0 },
      { name: "16-17", min: 16, max: 17, value: 0 },
      { name: "18-21", min: 18, max: 21, value: 0 },
      { name: "22-29", min: 22, max: 29, value: 0 },
      { name: "30+", min: 30, max: 200, value: 0 },
    ];
    for (const i of incidents) {
      if (!i.shooterAge) continue;
      const b = buckets.find((b) => i.shooterAge! >= b.min && i.shooterAge! <= b.max);
      if (b) b.value += 1;
    }
    return buckets;
  }, []);

  const byWeapon = useMemo(() => countBy(incidents, (i) => i.weaponType), []);
  const byRegion = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of aggregateByState()) {
      map.set(a.state.region, (map.get(a.state.region) ?? 0) + a.incidentCount);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, []);

  return (
    <div className="min-h-full">
      <PageHeader
        title="Trends Analysis"
        subtitle="Patterns over time, geography, demographics, and weaponry."
      />

      <div className="p-6 space-y-6">
        <Panel title="Cumulative Incidents Over Time">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={yearly}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff5d5d" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#ff5d5d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f2733" strokeDasharray="3 3" />
                <XAxis dataKey="year" stroke="#6b7689" fontSize={11} />
                <YAxis stroke="#6b7689" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "#10151c",
                    border: "1px solid #1f2733",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="incidents"
                  stroke="#ff5d5d"
                  fill="url(#g1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-hud-dim mt-3">
            The K-12 SSDB and other databases consistently show a steep upward
            trend in incidents, particularly post-2018. This subset reflects only
            major / well-documented events; the full curve is steeper still.
          </p>
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Incidents by Decade">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={byDecade}>
                  <CartesianGrid stroke="#1f2733" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#6b7689" fontSize={11} />
                  <YAxis stroke="#6b7689" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "#10151c",
                      border: "1px solid #1f2733",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="#ffb547" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Incidents by Region">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={byRegion}>
                  <CartesianGrid stroke="#1f2733" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#6b7689" fontSize={11} />
                  <YAxis stroke="#6b7689" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "#10151c",
                      border: "1px solid #1f2733",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="#5db5ff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-hud-dim mt-3">
              Regional totals reflect both raw incident counts and population
              size — see the Risk Factors page for population-normalized rates.
            </p>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Shooter Age Distribution">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={byShooterAge}>
                  <CartesianGrid stroke="#1f2733" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#6b7689" fontSize={11} />
                  <YAxis stroke="#6b7689" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "#10151c",
                      border: "1px solid #1f2733",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value">
                    {byShooterAge.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i <= 2 ? "#ff5d5d" : "#5db5ff"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-hud-dim mt-3">
              The plurality of K-12 attackers are 13–17 — current students of
              the targeted school.
            </p>
          </Panel>

          <Panel title="Weapon Type">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={byWeapon}>
                  <CartesianGrid stroke="#1f2733" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#6b7689" fontSize={11} />
                  <YAxis stroke="#6b7689" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "#10151c",
                      border: "1px solid #1f2733",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="#5dd2a3" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-hud-dim mt-3">
              Handguns are most common across all K-12 incidents; rifles
              disproportionately appear in mass-casualty events.
            </p>
          </Panel>
        </div>

        <Panel title="States by Total Incidents (this dataset)">
          <div className="h-[420px]">
            <ResponsiveContainer>
              <BarChart data={stateRanking} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid stroke="#1f2733" strokeDasharray="3 3" />
                <XAxis type="number" stroke="#6b7689" fontSize={11} />
                <YAxis
                  dataKey="state.code"
                  type="category"
                  stroke="#6b7689"
                  fontSize={11}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: "#10151c",
                    border: "1px solid #1f2733",
                    fontSize: 12,
                  }}
                  formatter={(v, _n, p) => [v, p?.payload?.state?.name]}
                />
                <Bar dataKey="incidentCount" fill="#ff5d5d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
