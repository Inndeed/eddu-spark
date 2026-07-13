import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'

const normalizeJoinCodeInput = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)

export function PlayerJoinPage() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const normalizedCode = normalizeJoinCodeInput(joinCode)
  const codeCells = Array.from({ length: 6 }, (_, index) => normalizedCode[index] ?? '')
  const isCodeComplete = normalizedCode.length === 6

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextCode = normalizedCode
    if (!isCodeComplete) {
      setError('ใส่รหัส 6 ตัว')
      return
    }

    navigate(`/play/join/${nextCode}`)
  }

  return (
    <main className="app-shell player-entry-shell">
      <section className="entry-card entry-card-player">
        <BrandLogo compact />
        <div className="entry-heading">
          <span className="eyebrow">รหัส</span>
          <h1 className="entry-title">รหัส</h1>
        </div>
        <div className="entry-pin-preview" aria-hidden="true">
          {codeCells.map((cell, index) => (
            <span className={`entry-pin-cell ${cell ? 'is-filled' : ''}`.trim()} key={index}>
              {cell || '•'}
            </span>
          ))}
        </div>
        <form className="entry-form" onSubmit={handleSubmit}>
          <label>
            <input
              aria-label="รหัสเข้าห้อง"
              autoComplete="off"
              autoFocus
              inputMode="text"
              placeholder="A1B2C3"
              value={normalizedCode}
              onChange={(event) => {
                setJoinCode(normalizeJoinCodeInput(event.target.value))
                setError(null)
              }}
            />
          </label>
          <button className="button button-primary button-block" disabled={!isCodeComplete} type="submit">
            ต่อไป
          </button>
        </form>
        {error ? <p className="error-text error-text-centered">{error}</p> : null}
        <Link className="text-link" to="/">
          กลับ
        </Link>
      </section>
    </main>
  )
}
