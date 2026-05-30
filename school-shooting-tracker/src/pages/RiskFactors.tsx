import { useMemo } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import PageHeader from "../components/PageHeader";
import Panel from "../components/Panel";
import { aggregateByState, computeStateRisk, pearson } from "../lib/analytics";

function riskColor(score: number): string {
  if (score >= 75) return "#ff5d5d";
  if (score >= 55) return "#ff8a3d";
  if (score >= 35) return "#ffb547";
  if (score >= 20) return "#5db5ff";
  return "#5dd2a3";
}

export default function RiskFactors() {
  const risk = useMemo(() => computeStateRisk(), []);

  const sorted = useMemo(
    () => [...risk].sort((a, b) => b.riskScore - a.riskScore),
    [risk]
  );

  const correlations = useMemo(() => {
    const agg = aggregateByState();
    const incidentRates = agg.map((a) => a.ratePerMillionStudents);
    const guns = agg.map((a) => a.state.householdGunPct);
    const laws = agg.map((a) => 4 - a.state.gunLawScore); // higher = weaker
    const pop = agg.map((a) => a.state.population);
    return [
      {
        label: "Household Gun Ownership %",
        r: pearson(guns, incidentRates),
        sub: "RAND state-level estimate",
      },
      {
        label: "Weakness of Gun Laws",
        r: pearson(laws, incidentRates),
        sub: "Inverted Giffords scorecard",
      },
      {
        label: "State Population",
        r: pearson(pop, incidentRates),
        sub: "Sanity check — should be near zero after normalization",
      },
    ];
  }, []);

  const scatterData = useMemo(
    () =>
      aggregateByState().map((a) => ({
        x: a.state.householdGunPct,
        y: a.ratePerMillionStudents,
        z: a.incidentCount,
        name: a.state.code,
      })),
    []
  );

  return (
    <div className="min-h-full">
      <PageHeader
        title="Structural Risk Factors"
        subtitle="A composite score per state based on historical incident rate, household gun prevalence, gun-law strength, and exposure (student population). NOT a prediction of any individual school. See Methodology."
      />

      <div className="p-6 space-y-6">
        {/* Disclaimer */}
        <div className="hud-panel border-hud-accent/40 bg-hud-accent/5 p-4">
          <div className="text-xs uppercase tracking-widest font-mono text-hud-accent mb-1">
            ⚠ Important
          </div>
          <p className="text-sm">
            This score is a <strong>relative comparison of structural conditions</strong>,
            not a prediction. School shootings are statistically rare events, and
            no responsible model can identify "the next" school. The score is
            meant to surface aggregate patterns for public discussion, not to
            stigmatize any community, school, or group.
          </p>
        </div>

        <Panel title="State Risk Ranking">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-hud-dim uppercase tracking-widest font-mono">
                <tr className="border-b border-hud-border">
                  <th className="text-left py-2 pr-4">#</th>
                  <th className="text-left py-2 pr-4">State</th>
                  <th className="text-right py-2 pr-4">Risk</th>
                  <th className="text-right py-2 pr-4">Hist. Rate</th>
                  <th className="text-right py-2 pr-4">Guns/HH</th>
                  <th className="text-right py-2 pr-4">Weak Laws</th>
                  <th className="text-right py-2">Exposure</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, idx) => (
                  <tr
                    key={r.state.code}
                    className="border-b border-hud-border/50 hover:bg-hud-panel2"
                  >
                    <td className="py-2 pr-4 text-hud-dim font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="font-mono font-bold mr-2">
                        {r.state.code}
                      </span>
                      <span className="text-hud-dim text-xs">
                        {r.state.name}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <span
                        className="inline-block px-2 py-0.5 rounded font-mono font-bold text-xs"
                        style={{
                          background: `${riskColor(r.riskScore)}22`,
                          color: riskColor(r.riskScore),
                        }}
                      >
                        {r.riskScore}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-hud-dim">
                      {(r.historicalRate * 100).toFixed(0)}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-hud-dim">
                      {r.state.householdGunPct}%
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-xs text-hud-dim">
                      {(r.weakLaws * 100).toFixed(0)}
                    </td>
                    <td className="py-2 text-right font-mono text-xs text-hud-dim">
                      {r.state.studentsK12.toFixed(2)}M
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Correlation with Historical Incident Rate">
            <ul className="space-y-4">
              {correlations.map((c) => {
                const pct = Math.abs(c.r) * 100;
                const positive = c.r >= 0;
                return (
                  <li key={c.label}>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <span>{c.label}</span>
                      <span
                        className={`font-mono font-bold ${
                          positive ? "text-hud-accent" : "text-hud-good"
                        }`}
                      >
                        r = {c.r.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 bg-hud-panel2 rounded relative">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${pct}%`,
                          background: positive ? "#ff5d5d" : "#5dd2a3",
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-hud-dim mt-1 font-mono">
                      {c.sub}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-hud-dim mt-4">
              Correlation ≠ causation. A positive r means the factor co-varies
              with incident rate, but does not establish a causal link. With
              only ~50 states, statistical power is limited.
            </p>
          </Panel>

          <Panel title="Gun Ownership vs Incident Rate">
            <div className="h-72">
              <ResponsiveContainer>
                <ScatterChart>
                  <CartesianGrid stroke="#1f2733" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="x"
                    name="Gun ownership %"
                    stroke="#6b7689"
                    fontSize={11}
                    label={{
                      value: "% Households with firearm",
                      position: "bottom",
                      offset: -5,
                      fill: "#6b7689",
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    dataKey="y"
                    name="Incidents / M students"
                    stroke="#6b7689"
                    fontSize={11}
                  />
                  <ZAxis dataKey="z" range={[20, 200]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "#10151c",
                      border: "1px solid #1f2733",
                      fontSize: 12,
                    }}
                    formatter={(v: unknown, name) => [
                      typeof v === "number" ? v.toFixed(2) : String(v),
                      name,
                    ]}
                    labelFormatter={() => ""}
                  />
                  <Scatter data={scatterData} fill="#ff5d5d" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <Panel title="What the data does NOT show">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="hud-panel p-3">
              <div className="hud-stat-label text-hud-good">Not ethnic</div>
              <p className="text-xs text-hud-dim mt-2">
                There is no consistent ethnic profile of school attackers across
                K-12 incidents in the United States. The most reliable
                demographic predictor is sex (overwhelmingly male) and prior
                connection to the school.
              </p>
            </div>
            <div className="hud-panel p-3">
              <div className="hud-stat-label text-hud-good">Not "territorial"</div>
              <p className="text-xs text-hud-dim mt-2">
                These are not gang-territory disputes in the typical sense. The
                FBI Active Shooter and US Secret Service NTAC studies show most
                attackers are individuals motivated by personal grievance,
                ideation, and crisis, not group conflict over territory.
              </p>
            </div>
            <div className="hud-panel p-3">
              <div className="hud-stat-label text-hud-accent">Strongly correlated</div>
              <p className="text-xs text-hud-dim mt-2">
                Access to firearms (especially unsecured household guns), prior
                school attendance by the attacker, leakage of intent prior to
                the attack, and a history of personal crisis are the most
                consistently observed factors.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
