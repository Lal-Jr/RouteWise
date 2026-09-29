import { useState } from 'react'
import type { LatLng, PlaceRole } from '../core/types'
import { Icon } from './Icon'
import { searchPlaces, type SearchResult } from '../services/geocode'

interface Props {
  near?: LatLng
  placeholder: string
  onPick: (result: SearchResult, as: PlaceRole) => void
  /** Offer "Set start" and "Set end" next to "Add stop". */
  allowAnchors?: boolean
}

export function SearchBox({ near, placeholder, onPick, allowAnchors = true }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Results already added as stops, so several can be added from one search. */
  const [added, setAdded] = useState<Set<number>>(new Set())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    setError(null)
    try {
      setResults(await searchPlaces(query.trim(), near))
      setAdded(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults(null)
    } finally {
      setBusy(false)
    }
  }

  function pick(r: SearchResult, i: number, as: PlaceRole) {
    onPick(r, as)
    if (as === 'stop') {
      setAdded((a) => new Set(a).add(i))
      return
    }
    close()
  }

  function close() {
    setResults(null)
    setQuery('')
  }

  return (
    <div className="search">
      <form onSubmit={submit} className="search-row">
        <div className="search-text">
          <span className="search-label">{near ? 'Add a place' : 'Start from'}</span>
          <input
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={placeholder}
          />
        </div>
        <button type="submit" className="search-go" disabled={busy} aria-label="Search">
          {busy ? <span className="spinner" aria-hidden /> : <Icon name="search" size={18} />}
        </button>
      </form>
      {error && <p className="muted small error-text">{error}</p>}
      {results && (
        <ul className="search-results">
          {results.length === 0 && <li className="muted small">No places found. Try adding the city name.</li>}
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <div className="search-result-text">
                <strong>{r.name}</strong>
                <span className="muted small">{r.detail}</span>
              </div>
              <div className="search-result-actions">
                <button className="btn btn-primary btn-sm" disabled={added.has(i)} onClick={() => pick(r, i, 'stop')}>
                  {added.has(i) ? 'Added ✓' : 'Add stop'}
                </button>
                {allowAnchors && (
                  <>
                    <button className="btn btn-sm" onClick={() => pick(r, i, 'start')}>
                      Set start
                    </button>
                    <button className="btn btn-sm" onClick={() => pick(r, i, 'end')}>
                      Set end
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
          {results.length > 0 && (
            <li className="search-done">
              <button className="btn btn-sm btn-ghost" onClick={close}>
                {added.size > 0 ? 'Done' : 'Close'}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
