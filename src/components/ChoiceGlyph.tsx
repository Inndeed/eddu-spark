const GLYPH_CLASSES = ['shape-triangle', 'shape-diamond', 'shape-circle', 'shape-square'] as const
const COLOR_CLASSES = ['answer-red', 'answer-orange', 'answer-yellow', 'answer-green'] as const

interface ChoiceGlyphProps {
  index: number
  className?: string
}

export function ChoiceGlyph({ index, className = '' }: ChoiceGlyphProps) {
  const glyphClass = GLYPH_CLASSES[index] ?? GLYPH_CLASSES[0]
  const colorClass = COLOR_CLASSES[index] ?? COLOR_CLASSES[0]

  return (
    <span className={`choice-glyph ${colorClass} ${className}`.trim()}>
      <span className={`shape-core ${glyphClass}`} />
    </span>
  )
}
