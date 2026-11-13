import { useState } from 'react'

export type HintPanelProps = {
  hints: string[]
  currentHintIndex: number
  onShowNextHint: () => void
  disabled?: boolean
}

export function HintPanel({
  hints,
  currentHintIndex,
  onShowNextHint,
  disabled = false,
}: HintPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasMoreHints = currentHintIndex < hints.length - 1
  const shownHints = hints.slice(0, currentHintIndex + 1)

  if (!hints || hints.length === 0) return null

  return (
    <div className="learn-hint-panel">
      <div className="learn-hint-header">
        <button
          type="button"
          className="learn-hint-btn"
          disabled={disabled}
          onClick={() => {
            if (currentHintIndex < 0) {
              onShowNextHint()
            }
            setIsExpanded(true)
          }}
          aria-expanded={isExpanded}
        >
          <span className="hint-bulb" aria-hidden="true">💡</span>
          <span>
            {currentHintIndex < 0
              ? 'Nhận gợi ý'
              : hasMoreHints
              ? `Gợi ý tiếp theo (${currentHintIndex + 2}/${hints.length})`
              : 'Đã xem hết gợi ý'}
          </span>
        </button>

        {currentHintIndex >= 0 && hasMoreHints && (
          <button
            type="button"
            className="learn-hint-next-btn"
            disabled={disabled}
            onClick={onShowNextHint}
          >
            Thêm gợi ý
          </button>
        )}
      </div>

      {isExpanded && currentHintIndex >= 0 && (
        <div className="learn-hint-body" role="status" aria-live="polite">
          {shownHints.map((hint, idx) => (
            <div key={idx} className="hint-item">
              <span className="hint-num">Gợi ý {idx + 1}:</span>
              <span className="hint-text">{hint}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

