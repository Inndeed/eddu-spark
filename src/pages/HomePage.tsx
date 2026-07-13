import { Link } from 'react-router-dom'

import { BrandLogo } from '../components/BrandLogo'
import { PosterFrame } from '../components/PosterFrame'
import { SoundToggle } from '../components/SoundToggle'
import { useQuizAudio } from '../lib/audio'

export function HomePage() {
  const { muted, toggleMuted } = useQuizAudio(true)

  return (
    <main className="app-shell home-shell">
      <PosterFrame className="poster-hero poster-frame-home" contentClassName="poster-center">
          <BrandLogo />
          <div className="hero-title-block">
            <span className="eyebrow hero-eyebrow">Eddu</span>
            <h1>Eddu Quiz</h1>
          </div>
          <div className="hero-actions hero-actions-stacked">
            <Link className="button button-primary" to="/host">
              เข้า Host
            </Link>
            <Link className="button button-secondary" to="/play">
              เข้าเล่น
            </Link>
          </div>
        <SoundToggle className="hero-sound" muted={muted} onToggle={toggleMuted} />
      </PosterFrame>
    </main>
  )
}
