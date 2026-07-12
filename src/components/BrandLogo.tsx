import { Link } from 'react-router-dom'

interface BrandLogoProps {
  className?: string
  compact?: boolean
  to?: string
}

export function BrandLogo({ className = '', compact = false, to }: BrandLogoProps) {
  const content = (
    <div className={`brand-logo ${compact ? 'brand-logo-compact' : ''} ${className}`.trim()}>
      <span className="brand-mark">
        <img alt="eddu.org" src="/eddu-wordmark.svg" />
      </span>
    </div>
  )

  if (to) {
    return <Link to={to}>{content}</Link>
  }

  return content
}
