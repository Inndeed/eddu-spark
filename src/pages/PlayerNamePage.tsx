import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'
import { joinSession } from '../lib/api'
import { getPlayerRecord, setPlayerRecord } from '../lib/storage'

export function PlayerNamePage() {
  const navigate = useNavigate()
  const { joinCode = '' } = useParams()
  const normalizedJoinCode = joinCode.toUpperCase()
  const remembered = useMemo(() => getPlayerRecord('recent') ?? null, [])
  const [displayName, setDisplayName] = useState(remembered?.displayName ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codeCells = Array.from({ length: 6 }, (_, index) => normalizedJoinCode[index] ?? '')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = await joinSession(normalizedJoinCode, displayName)
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
      <section className="entry-card entry-card-player">
        <BrandLogo compact />
        <div className="entry-heading">
          <span className="eyebrow">ห้อง</span>
          <div className="entry-pin-preview entry-pin-preview-tight" aria-hidden="true">
            {codeCells.map((cell, index) => (
              <span className={`entry-pin-cell ${cell ? 'is-filled' : ''}`.trim()} key={index}>
                {cell || '•'}
              </span>
            ))}
          </div>
        </div>
        <form className="entry-form" onSubmit={handleSubmit}>
          <div className="entry-player-badge">
            <span className="eyebrow">ชื่อ</span>
            <h1 className="entry-title">ชื่อ</h1>
          </div>
          <label>
            <input
              aria-label="Display name"
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
