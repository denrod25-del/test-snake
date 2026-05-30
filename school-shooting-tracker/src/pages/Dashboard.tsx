import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "../components/PageHeader";
import Panel from "../components/Panel";
import StatCard from "../components/StatCard";
import { incidents } from "../data/incidents";
import { aggregateByState, aggregateByYear, countBy } from "../lib/analytics";

const CHART_COLORS = ["#ff5d5d", "#ffb547", "#5db5ff", "#5dd2a3", "#b67cff", "#ff7eb6"];

export default function Dashboard() {
  const stats = useMemo(() => {
    const totalKilled = incidents.reduce((s, i) => s + i.killed, 0);
    const totalWounded = incidents.reduce((s, i) => s + i.wounded, 0);
    const massCount = incidents.filter((i) => i.category === "mass").length;
    const k12 = incidents.filter((i) => i.level !== "college").length;
    return { totalKilled, totalWounded, massCount, k12 };
  }, []);

  const yearly = useMemo(() => aggregateByYear(), []);
  const stateRanking = useMemo(
    () =>
      aggregateByState()
        .filter((s) => s.incidentCount > 0)
        .sort((a, b) => b.incidentCount - a.incidentCount)
        .slice(0, 10),
    []
  );

  const byCategory = useMemo(() => countBy(incidents, (i) => i.category), []);
  const byLevel = useMemo(() => countBy(incidents, (i) => i.level), []);
  const byRelation = useMemo(
    () => countBy(incidents, (i) => i.shooterRelation),
    []
  );

  const recent = useMemo(
    () =>
      [...incidents].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    []
  );

  return (
    <div className="min-h-full">
      <PageHeader
        title="National Overview"
        subtitle="A consolidated HUD of documented school shooting incidents in the United States. Numbers reflect the curated dataset bundled with this app — see Methodology for limitations."
      />

      <div className="p-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Documented Incidents"
            value={incidents.length}
            sub="In bundled dataset"
          />
          <StatCard
            label="Lives Lost"
            value={stats.totalKilled}
            sub="Excluding shooters"
            accent="accent"
          />
          <StatCard
            label="Wounded"
            value={stats.totalWounded}
            sub="Non-fatal injuries"
            accent="info"
          />
          <StatCard
            label="Mass-Casualty Events"
            value={stats.massCount}
            sub="4+ killed"
            accent="accent"
          />
        </div>

        {/* Yearly trend */}
        <Panel
          title="Incidents per Year"
          right={
            <Link to="/trends" className="text-hud-info hover:underline text-[11px]">
              View Trends →
            </Link>
          }
        >
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={yearly}>
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
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="incidents"
                  stroke="#ff5d5d"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="killed"
                  stroke="#ffb547"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Panel title="Top States by Incident Count" className="lg:col-span-2">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={stateRanking} layout="vertical" margin={{ left: 20 }}>
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

          <Panel title="Incident Type">
            <ul className="space-y-2 text-sm">
              {byCategory.map((c, i) => {
                const pct = (c.value / incidents.length) * 100;
                return (
                  <li key={c.name}>
                    <div className="flex justify-between text-xs font-mono mb-1">
                      <span className="capitalize">{c.name}</span>
                      <span className="text-hud-dim">
                        {c.value} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-hud-panel2 rounded">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${pct}%`,
                          background: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Recent Incidents">
            <ul className="divide-y divide-hud-border">
              {recent.map((i) => (
                <li key={i.id} className="py-3 flex items-start gap-4">
                  <div className="w-20 shrink-0 font-mono text-xs text-hud-dim">
                    {i.date}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{i.school}</div>
                    <div className="text-xs text-hud-dim">
                      {i.city}, {i.state} · {i.level}
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono">
                    <div className="text-hud-accent">{i.killed} killed</div>
                    <div className="text-hud-info">{i.wounded} wounded</div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Shooter Relationship to School">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={byRelation}>
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
                    {byRelation.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-xs text-hud-dim">
              The data consistently shows attackers are overwhelmingly current or
              former students of the targeted school. This is one of the strongest
              empirical patterns in the literature.
            </div>
          </Panel>
        </div>

        <Panel title="By School Level">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={byLevel}>
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
                  {byLevel.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
