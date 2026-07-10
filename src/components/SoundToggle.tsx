interface SoundToggleProps {
  muted: boolean
  onToggle: () => void
  className?: string
}

export function SoundToggle({ muted, onToggle, className = '' }: SoundToggleProps) {
  return (
    <button
      className={`sound-toggle ${className}`.trim()}
      onClick={onToggle}
      type="button"
    >
      <span>{muted ? 'Sound Off' : 'Sound On'}</span>
    </button>
  )
}
