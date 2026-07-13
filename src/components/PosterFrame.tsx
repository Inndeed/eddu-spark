import type { PropsWithChildren } from 'react'

interface PosterFrameProps extends PropsWithChildren {
  className?: string
  contentClassName?: string
}

export function PosterFrame({
  children,
  className = '',
  contentClassName = '',
}: PosterFrameProps) {
  return (
    <section className={`poster-frame ${className}`.trim()}>
      <div className="poster-rail poster-rail-left" />
      <div className="poster-rail poster-rail-right" />
      <div className={`poster-frame-content ${contentClassName}`.trim()}>{children}</div>
      <div className="hero-corner hero-corner-orange" />
      <div className="hero-corner hero-corner-yellow" />
    </section>
  )
}
