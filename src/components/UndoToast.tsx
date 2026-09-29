import { useEffect } from 'react'
import type { UndoEntry } from '../state/useTripPlanner'

interface Props {
  entry: UndoEntry
  onUndo: () => void
  onDismiss: () => void
}

const VISIBLE_MS = 8000

/** Short-lived "Removed X · Undo" toast; disappears on its own after a few seconds. */
export function UndoToast({ entry, onUndo, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [entry.id, onDismiss])

  return (
    <div className="toast" role="status">
      <span>{entry.label}</span>
      <button className="btn btn-sm" onClick={onUndo}>
        Undo
      </button>
    </div>
  )
}
