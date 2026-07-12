import { Link } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'
import { SoundToggle } from '../components/SoundToggle'
import { useQuizAudio } from '../lib/audio'

export function HomePage() {
  const { muted, toggleMuted } = useQuizAudio(true)

  return (
    <main className="app-shell home-shell">
      <section className="poster-hero">
        <div className="poster-rail poster-rail-left" />
        <div className="poster-rail poster-rail-right" />
        <div className="poster-center">
          <BrandLogo />
          <div className="hero-title-block">
            <span className="eyebrow hero-eyebrow">Eddu</span>
            <h1>Eddu Quiz</h1>
          </div>
          <div className="hero-actions hero-actions-stacked">
            <Link className="button button-primary" to="/host">
              Host
            </Link>
            <Link className="button button-secondary" to="/play">
              Join
            </Link>
          </div>
        </div>
        <div className="hero-corner hero-corner-orange" />
        <div className="hero-corner hero-corner-yellow" />
        <SoundToggle className="hero-sound" muted={muted} onToggle={toggleMuted} />
      </section>
    </main>
  )
}
