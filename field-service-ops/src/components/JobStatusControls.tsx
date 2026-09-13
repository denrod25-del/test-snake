import type { JobStatus } from '../lib/types';
import { nextStatuses } from '../lib/job-status';

const ALL: JobStatus[] = ['unassigned', 'scheduled', 'en_route', 'on_site', 'done'];

export function JobStatusControls({
  status,
  onChange,
}: {
  status: JobStatus;
  onChange: (s: JobStatus) => void;
}) {
  const suggested = nextStatuses(status);
  return (
    <div className="stack">
      <div className="status-row">
        {ALL.map((s) => (
          <button
            key={s}
            type="button"
            className={s === status ? '' : 'secondary'}
            onClick={() => onChange(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {suggested.length > 0 && (
        <p className="muted">Suggested next: {suggested.join(', ')} (office may override).</p>
      )}
    </div>
  );
}
