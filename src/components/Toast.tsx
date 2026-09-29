import { useEffect } from 'react'
import type { Toast as ToastEntry } from '../state/useTripPlanner'

interface Props {
  entry: ToastEntry
  onUndo: () => void
  onDismiss: () => void
}

const VISIBLE_MS = 8000

/** Short-lived message such as "Removed X · Undo"; disappears on its own after a few seconds. */
export function Toast({ entry, onUndo, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [entry.id, onDismiss])

  return (
    <div className="toast" role="status">
      <span>{entry.label}</span>
      {entry.restore && (
        <button className="btn btn-sm" onClick={onUndo}>
          Undo
        </button>
      )}
    </div>
  )
}
