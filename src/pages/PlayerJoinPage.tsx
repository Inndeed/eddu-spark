import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { joinSession } from '../lib/api'
import { getPlayerRecord, setPlayerRecord } from '../lib/storage'

export function PlayerJoinPage() {
  const navigate = useNavigate()
  const remembered = useMemo(() => getPlayerRecord('recent') ?? null, [])
  const [joinCode, setJoinCode] = useState('')
  const [displayName, setDisplayName] = useState(remembered?.displayName ?? '')
  const [teamName, setTeamName] = useState(remembered?.teamName ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = await joinSession(joinCode.toUpperCase(), displayName, teamName)
      setPlayerRecord({
        joinCode: payload.joinCode,
        participantId: payload.participantId,
        displayName,
        teamName,
      })
      setPlayerRecord({
        joinCode: 'recent',
        participantId: payload.participantId,
        displayName,
        teamName,
      })
      navigate(`/play/session/${payload.joinCode}?participantId=${payload.participantId}`)
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to join session')
      setLoading(false)
    }
  }

  return (
    <main className="app-shell player-shell">
      <section className="player-join-panel">
        <Link className="eyebrow-link" to="/">
          ← กลับหน้าแรก
        </Link>
        <span className="eyebrow">Join Session</span>
        <h1>เข้าร่วม EDDU Spark</h1>
        <p className="hero-text">
          กรอก join code, ชื่อ, และทีมของคุณ แล้วเตรียมตอบผ่านมือถือได้เลย
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Join code
            <input
              maxLength={6}
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="A1B2C3"
            />
          </label>
          <label>
            ชื่อที่ใช้แสดงผล
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Mika"
            />
          </label>
          <label>
            ทีม / แผนก
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Product"
            />
          </label>
          <button className="button button-primary" disabled={loading} type="submit">
            {loading ? 'กำลังเข้าเกม...' : 'Join live session'}
          </button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </main>
  )
}
