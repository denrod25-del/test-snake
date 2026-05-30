interface Props {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "accent" | "good" | "info";
}

const accentMap = {
  default: "text-hud-text",
  accent: "text-hud-accent",
  good: "text-hud-good",
  info: "text-hud-info",
};

export default function StatCard({ label, value, sub, accent = "default" }: Props) {
  return (
    <div className="hud-panel p-4">
      <div className="hud-stat-label">{label}</div>
      <div className={`hud-stat-value mt-2 ${accentMap[accent]}`}>{value}</div>
      {sub && <div className="text-xs text-hud-dim mt-1 font-mono">{sub}</div>}
    </div>
  );
}
