import type { ReactNode } from 'react'

export type HintWalkthroughCardProps = {
  step: number
  totalSteps: number
  title: string
  description: ReactNode
  value: number
  techniqueTag: string
  onNext: () => void
  onPrev: () => void
  onApply: () => void
  onClose: () => void
}

export function HintWalkthroughCard({
  step,
  totalSteps,
  title,
  description,
  value,
  techniqueTag,
  onNext,
  onPrev,
  onApply,
  onClose,
}: HintWalkthroughCardProps) {
  return (
    <div
      className="hint-walkthrough-card"
      role="dialog"
      aria-labelledby="hint-title"
      aria-modal="false"
    >
      <div className="hint-card-header">
        <span className="hint-badge">💡 {techniqueTag}</span>
        <button
          type="button"
          className="hint-close-button"
          onClick={onClose}
          aria-label="Đóng gợi ý"
        >
          ✕
        </button>
      </div>

      <div className="hint-card-body">
        <h3 id="hint-title" className="hint-title">
          {title}
        </h3>
        <div className="hint-description">{description}</div>
      </div>

      <div className="hint-card-footer">
        <button
          type="button"
          className="hint-nav-button prev"
          onClick={onPrev}
          disabled={step <= 1}
          aria-label="Bước trước"
        >
          ←
        </button>

        <div className="hint-dots" aria-label={`Bước ${step} trên ${totalSteps}`}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={`hint-dot${step === i + 1 ? ' active' : ''}`}
            />
          ))}
        </div>

        {step < totalSteps ? (
          <button
            type="button"
            className="hint-nav-button next"
            onClick={onNext}
            aria-label="Bước tiếp theo"
          >
            →
          </button>
        ) : (
          <button
            type="button"
            className="hint-apply-button"
            onClick={onApply}
            aria-label={`Điền số ${value}`}
          >
            ✓
          </button>
        )}
      </div>
    </div>
  )
}
