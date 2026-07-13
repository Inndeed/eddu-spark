import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'
import { PosterFrame } from '../components/PosterFrame'
import { joinSession } from '../lib/api'
import { toLocalizedError } from '../lib/errors'
import { isCompleteJoinCode, normalizeJoinCode } from '../lib/join-code'
import { getPlayerRecord, setPlayerRecord } from '../lib/storage'

export function PlayerNamePage() {
  const navigate = useNavigate()
  const { joinCode = '' } = useParams()
  const normalizedJoinCode = normalizeJoinCode(joinCode)
  const remembered = useMemo(() => getPlayerRecord('recent') ?? null, [])
  const [displayName, setDisplayName] = useState(remembered?.displayName ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codeCells = Array.from({ length: 6 }, (_, index) => normalizedJoinCode[index] ?? '')
  const isJoinCodeComplete = isCompleteJoinCode(normalizedJoinCode)
  const normalizedDisplayName = displayName.trim()

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isJoinCodeComplete) {
      setError('รหัสห้องไม่ถูกต้อง')
      return
    }

    if (!normalizedDisplayName) {
      setError('ใส่ชื่อก่อนเข้าเล่น')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = await joinSession(normalizedJoinCode, normalizedDisplayName)
      setPlayerRecord({
        joinCode: payload.joinCode,
        participantId: payload.participantId,
        displayName: normalizedDisplayName,
      })
      setPlayerRecord({
        joinCode: 'recent',
        participantId: payload.participantId,
        displayName: normalizedDisplayName,
      })
      navigate(`/play/session/${payload.joinCode}?participantId=${payload.participantId}`)
    } catch (joinError) {
      setError(toLocalizedError(joinError, 'เข้าห้องไม่สำเร็จ'))
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <PosterFrame className="poster-frame-page poster-frame-entry" contentClassName="player-entry-shell">
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
          {!isJoinCodeComplete ? <p className="error-text error-text-centered">รหัสห้องไม่ถูกต้อง</p> : null}
          <form className="entry-form" onSubmit={handleSubmit}>
            <div className="entry-player-badge">
              <span className="eyebrow">ชื่อ</span>
              <h1 className="entry-title">ชื่อ</h1>
            </div>
            <label>
              <input
                aria-label="ชื่อผู้เล่น"
                autoComplete="name"
                autoFocus
                placeholder="Mika"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value)
                  setError(null)
                }}
              />
            </label>
            <button
              className="button button-primary button-block"
              disabled={loading || !normalizedDisplayName || !isJoinCodeComplete}
              type="submit"
            >
              {loading ? 'กำลังเข้า...' : 'เข้าเล่น'}
            </button>
          </form>
          {error ? <p className="error-text error-text-centered">{error}</p> : null}
          <Link className="text-link" to="/play">
            เปลี่ยนรหัส
          </Link>
        </section>
      </PosterFrame>
    </main>
  )
}
