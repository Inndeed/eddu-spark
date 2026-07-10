import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { joinSession } from '../lib/api'
import { getPlayerRecord, setPlayerRecord } from '../lib/storage'

export function PlayerNamePage() {
  const navigate = useNavigate()
  const { joinCode = '' } = useParams()
  const remembered = useMemo(() => getPlayerRecord('recent') ?? null, [])
  const [displayName, setDisplayName] = useState(remembered?.displayName ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = await joinSession(joinCode.toUpperCase(), displayName)
      setPlayerRecord({
        joinCode: payload.joinCode,
        participantId: payload.participantId,
        displayName,
      })
      setPlayerRecord({
        joinCode: 'recent',
        participantId: payload.participantId,
        displayName,
      })
      navigate(`/play/session/${payload.joinCode}?participantId=${payload.participantId}`)
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to join session')
      setLoading(false)
    }
  }

  return (
    <main className="app-shell player-entry-shell">
      <section className="entry-card">
        <span className="entry-code">{joinCode}</span>
        <form className="entry-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input
              autoFocus
              placeholder="Mika"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <button className="button button-primary button-block" disabled={loading} type="submit">
            {loading ? 'กำลังเข้า...' : 'เข้าเล่น'}
          </button>
        </form>
        {error ? <p className="error-text error-text-centered">{error}</p> : null}
        <Link className="text-link" to="/play">
          เปลี่ยนรหัส
        </Link>
      </section>
    </main>
  )
}
