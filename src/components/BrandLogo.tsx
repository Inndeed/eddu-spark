interface BrandLogoProps {
  className?: string
  compact?: boolean
}

export function BrandLogo({ className = '', compact = false }: BrandLogoProps) {
  return (
    <div className={`brand-logo ${compact ? 'brand-logo-compact' : ''} ${className}`.trim()}>
      <img alt="eddu.org" src="/eddu-wordmark.svg" />
      <div className="brand-copy">
        <strong>Eddu Quiz</strong>
        <span>Live workshop quiz</span>
      </div>
    </div>
  )
}
