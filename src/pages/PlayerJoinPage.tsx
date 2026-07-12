import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'

export function PlayerJoinPage() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const normalizedCode = joinCode.trim().toUpperCase().slice(0, 6)
  const codeCells = Array.from({ length: 6 }, (_, index) => normalizedCode[index] ?? '')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextCode = normalizedCode
    if (!nextCode) {
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
          <h1 className="entry-title">Code</h1>
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
              aria-label="Join code"
              autoFocus
              inputMode="text"
              maxLength={6}
              placeholder="A1B2C3"
              value={normalizedCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            />
          </label>
          <button className="button button-primary button-block" type="submit">
            ต่อไป
          </button>
        </form>
        <Link className="text-link" to="/">
          กลับ
        </Link>
      </section>
    </main>
  )
}
