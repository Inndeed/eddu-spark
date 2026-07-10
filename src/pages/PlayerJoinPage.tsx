import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'

export function PlayerJoinPage() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextCode = joinCode.trim().toUpperCase()
    if (!nextCode) {
      return
    }

    navigate(`/play/join/${nextCode}`)
  }

  return (
    <main className="app-shell player-entry-shell">
      <section className="entry-card">
        <BrandLogo compact />
        <form className="entry-form" onSubmit={handleSubmit}>
          <label>
            Code
            <input
              autoFocus
              inputMode="text"
              maxLength={6}
              placeholder="A1B2C3"
              value={joinCode}
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
