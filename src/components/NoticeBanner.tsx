import { formatDuration } from '../core/time'
import type { Notice } from '../state/useTripPlanner'

interface Props {
  notice: Notice
  nameOf: (id: string) => string
  onDismiss: () => void
}

const HEADLINE = {
  none: 'Plan updated',
  retime: 'Schedule shifted',
  reorder: 'Plan repaired: stops reordered',
  drop: 'Plan repaired: stops dropped to stay feasible',
  optimized: 'Plan re-optimized',
} as const

export function NoticeBanner({ notice, nameOf, onDismiss }: Props) {
  const lines: string[] = []
  if (notice.strategy === 'optimized') {
    const saved = Math.round(notice.saved ?? 0)
    lines.push(saved > 0 ? `Saved ${formatDuration(saved)} of travel.` : 'The current plan was already the best found.')
  }
  const shifts = notice.changes.filter((c) => c.kind === 'shifted')
  for (const c of notice.changes) {
    if (c.kind === 'dropped') lines.push(`Dropped ${nameOf(c.stopId)}`)
    if (c.kind === 'restored') lines.push(`Restored ${nameOf(c.stopId)}`)
    if (c.kind === 'added') lines.push(`Added ${nameOf(c.stopId)}`)
    if (c.kind === 'moved') lines.push(`Moved ${nameOf(c.stopId)} to position ${c.to + 1}`)
  }
  if (shifts.length) {
    const max = Math.max(...shifts.map((c) => (c.kind === 'shifted' ? Math.abs(c.by) : 0)))
    lines.push(`${shifts.length} visit${shifts.length > 1 ? 's' : ''} retimed (up to ${formatDuration(max)})`)
  }

  const tone = notice.strategy === 'drop' ? 'warn' : notice.strategy === 'optimized' ? 'ok' : 'info'
  return (
    <div className={`notice notice-${tone}`} role="status">
      <div className="notice-body">
        <strong>{HEADLINE[notice.strategy]}</strong>
        {notice.reason && <span className="muted small"> · {notice.reason}</span>}
        {lines.length > 0 && (
          <ul>
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>
      <button className="icon-btn" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
