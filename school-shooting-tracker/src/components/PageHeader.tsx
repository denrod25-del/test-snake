interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, right }: Props) {
  return (
    <div className="px-6 py-5 border-b border-hud-border flex items-end justify-between bg-hud-panel">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-hud-dim font-mono">
          // {new Date().toISOString().slice(0, 10)} — sector overview
        </div>
        <h2 className="text-2xl font-bold mt-1">{title}</h2>
        {subtitle && (
          <p className="text-sm text-hud-dim mt-1 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}
