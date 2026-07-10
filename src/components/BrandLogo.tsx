import { Link } from 'react-router-dom'

interface BrandLogoProps {
  className?: string
  compact?: boolean
  to?: string
}

export function BrandLogo({ className = '', compact = false, to }: BrandLogoProps) {
  const content = (
    <div className={`brand-logo ${compact ? 'brand-logo-compact' : ''} ${className}`.trim()}>
      <img alt="eddu.org" src="/eddu-wordmark.svg" />
      <div className="brand-copy">
        <strong>Eddu Quiz</strong>
      </div>
    </div>
  )

  if (to) {
    return <Link to={to}>{content}</Link>
  }

  return content
}
