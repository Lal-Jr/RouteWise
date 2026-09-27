import { useState } from 'react'
import type { LatLng } from '../core/types'
import { searchPlaces, type SearchResult } from '../services/geocode'

interface Props {
  near?: LatLng
  placeholder: string
  onPick: (result: SearchResult, as: 'stop' | 'start') => void
  /** Offer "Set as start" next to "Add stop". */
  allowStart?: boolean
}

export function SearchBox({ near, placeholder, onPick, allowStart = true }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    setError(null)
    try {
      setResults(await searchPlaces(query.trim(), near))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults(null)
    } finally {
      setBusy(false)
    }
  }

  function pick(r: SearchResult, as: 'stop' | 'start') {
    onPick(r, as)
    setResults(null)
    setQuery('')
  }

  return (
    <div className="search">
      <form onSubmit={submit} className="search-row">
        <input
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={placeholder}
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p className="muted small error-text">{error}</p>}
      {results && (
        <ul className="search-results">
          {results.length === 0 && <li className="muted small">No places found.</li>}
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <div className="search-result-text">
                <strong>{r.name}</strong>
                <span className="muted small">{r.detail}</span>
              </div>
              <div className="search-result-actions">
                <button className="btn btn-primary btn-sm" onClick={() => pick(r, 'stop')}>
                  Add stop
                </button>
                {allowStart && (
                  <button className="btn btn-sm" onClick={() => pick(r, 'start')}>
                    Set start
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
