interface Props {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function Panel({ title, right, children, className = "" }: Props) {
  return (
    <div className={`hud-panel ${className}`}>
      <div className="hud-panel-header">
        <span>// {title}</span>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
