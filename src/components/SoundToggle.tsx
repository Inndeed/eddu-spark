interface SoundToggleProps {
  muted: boolean
  onToggle: () => void
  className?: string
}

export function SoundToggle({ muted, onToggle, className = '' }: SoundToggleProps) {
  return (
    <button
      aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
      className={`sound-toggle ${className}`.trim()}
      onClick={onToggle}
      type="button"
    >
      <span className={`sound-toggle-dot ${muted ? 'is-muted' : 'is-live'}`.trim()} aria-hidden="true" />
      <span>{muted ? 'ปิดเสียง' : 'เสียง'}</span>
    </button>
  )
}
