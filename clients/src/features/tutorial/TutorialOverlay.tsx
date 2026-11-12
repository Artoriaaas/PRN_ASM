/**
 * TutorialOverlay — giao diện step-by-step hiển thị trên bàn cờ trong SoloPlayPage.
 * Hiện một tooltip/card nổi hướng dẫn từng bước, với nút Tiếp theo / Quay lại / Bỏ qua.
 */
import { useEffect } from 'react'
import type { TutorialStep } from './tutorialData'

type TutorialOverlayProps = {
  steps: TutorialStep[]
  currentStep: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
  onComplete: () => void
  /** Callback để highlight/select ô trên bàn cờ theo step */
  onSelectCell?: (index: number | null) => void
  /** Callback khi step có action toggle-notes */
  onToggleNotes?: () => void
  /** Callback khi step có action hint */
  onRequestHint?: () => void
}

export function TutorialOverlay({
  steps,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  onSelectCell,
  onToggleNotes,
  onRequestHint,
}: TutorialOverlayProps) {
  const step = steps[currentStep]
  const isLast = currentStep === totalSteps - 1
  const progress = Math.round(((currentStep + 1) / totalSteps) * 100)

  // Áp dụng selectCell của step lên bàn cờ
  useEffect(() => {
    if (step?.selectCell !== undefined) {
      onSelectCell?.(step.selectCell)
    }
  }, [currentStep, step?.selectCell, onSelectCell])

  if (!step) return null

  function handleAction() {
    if (!step.action) return
    if (step.action.type === 'toggle-notes') onToggleNotes?.()
    if (step.action.type === 'hint') onRequestHint?.()
    onNext()
  }

  return (
    <div className="tutorial-overlay" role="region" aria-label="Hướng dẫn chơi">
      {/* Thanh tiến trình */}
      <div className="tut-progress-bar" aria-hidden="true">
        <div className="tut-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Card nội dung */}
      <div className="tut-card" role="dialog" aria-labelledby="tut-step-title">
        <div className="tut-card-top">
          <div className="tut-step-counter">
            <span>Bước {currentStep + 1} / {totalSteps}</span>
            <button
              type="button"
              className="tut-skip-btn"
              onClick={onSkip}
              aria-label="Bỏ qua toàn bộ hướng dẫn"
            >
              Bỏ qua ✕
            </button>
          </div>

          <div className="tut-step-heading">
            {step.icon && <span className="tut-step-icon" aria-hidden="true">{step.icon}</span>}
            <h3 id="tut-step-title" className="tut-step-title">{step.title}</h3>
          </div>

          <p className="tut-step-content">{step.content}</p>
        </div>

        {/* Dots navigation */}
        <div className="tut-dots" aria-hidden="true">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`tut-dot${i === currentStep ? ' active' : ''}${i < currentStep ? ' done' : ''}`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="tut-card-actions">
          {currentStep > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onPrev}
              aria-label="Bước trước"
            >
              ← Quay lại
            </button>
          )}

          <div className="tut-actions-right">
            {step.action && (
              <button
                type="button"
                className="btn btn-ghost btn-sm tut-action-btn"
                onClick={handleAction}
              >
                {step.action.label}
              </button>
            )}

            {isLast ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onComplete}
              >
                Hoàn thành 🎉
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onNext}
                aria-label="Bước tiếp theo"
              >
                Tiếp theo →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

