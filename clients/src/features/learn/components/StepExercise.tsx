import type { ExerciseTask } from '../types'
import { HintPanel } from './HintPanel'

export type StepExerciseProps = {
  title: string
  prompt: string
  task: ExerciseTask
  hints: string[]
  successMessage: string
  answerExplanation?: string
  isSolved: boolean
  wrongCount: number
  lastError: string | null
  currentHintIndex: number
  canGoBack: boolean
  isLastStep: boolean
  onNext: () => void
  onPrev: () => void
  onShowNextHint: () => void
  onRevealAnswer: () => void
}

export function StepExercise({
  title,
  prompt,
  task,
  hints,
  successMessage,
  answerExplanation,
  isSolved,
  wrongCount,
  lastError,
  currentHintIndex,
  canGoBack,
  isLastStep,
  onNext,
  onPrev,
  onShowNextHint,
  onRevealAnswer,
}: StepExerciseProps) {
  const showAnswerReason = isSolved && wrongCount >= 3
  const canShowReveal = wrongCount >= 3 && !isSolved

  // Hướng dẫn thao tác theo loại bài tập
  let instructionHelper = ''
  if (task.type === 'fill-cell') {
    instructionHelper = '👉 Hãy chọn ô trên bàn và dùng bàn phím số bên dưới để điền số.'
  } else if (task.type === 'pick-cell') {
    instructionHelper = '👉 Hãy bấm trực tiếp vào ô bạn chọn trên bàn cờ.'
  } else if (task.type === 'pick-candidates') {
    instructionHelper = '👉 Hãy bật chế độ Ghi chú và điền các số ứng viên vào ô.'
  } else if (task.type === 'eliminate') {
    instructionHelper = `👉 Bấm vào các ô bị chặn bởi số ${task.number} để loại bỏ.`
  }

  return (
    <div className="step-exercise-pane">
      <div className="step-badge exercise-badge">BÀI TẬP THỰC HÀNH</div>
      <h2 className="step-title">{title}</h2>

      <div className="exercise-prompt-box">
        <p className="exercise-prompt-text">{prompt}</p>
        <p className="exercise-instruction-helper">{instructionHelper}</p>
      </div>

      {/* Thông báo kết quả / Lỗi */}
      {isSolved && (
        <div className="exercise-status-alert success-alert" role="status" aria-live="polite">
          <span className="status-icon" aria-hidden="true">🎉</span>
          <div className="status-content">
            <strong>Chính xác!</strong> {successMessage}
          </div>
        </div>
      )}

      {!isSolved && lastError && (
        <div className="exercise-status-alert error-alert" role="alert" aria-live="assertive">
          <span className="status-icon" aria-hidden="true">⚠️</span>
          <div className="status-content">
            {lastError} (Thử sai: {wrongCount} lần)
          </div>
        </div>
      )}

      {/* Lời giải thích khi xem đáp án */}
      {isSolved && showAnswerReason && answerExplanation && (
        <div className="exercise-explanation-box">
          <div className="explanation-title">💡 Giải thích đáp án:</div>
          <p className="explanation-text">{answerExplanation}</p>
        </div>
      )}

      {/* Panel gợi ý */}
      <HintPanel
        hints={hints}
        currentHintIndex={currentHintIndex}
        onShowNextHint={onShowNextHint}
        disabled={isSolved}
      />

      {/* Nút xem đáp án sau 3 lần sai */}
      {canShowReveal && (
        <div className="reveal-answer-box">
          <button
            type="button"
            className="btn-reveal-answer"
            onClick={onRevealAnswer}
          >
            <span>🔓 Bạn gặp khó khăn? Bấm để xem đáp án</span>
          </button>
        </div>
      )}

      {/* Điều hướng bước */}
      <div className="step-footer-actions">
        {canGoBack && (
          <button type="button" className="btn-secondary step-back-btn" onClick={onPrev}>
            ← Quay lại
          </button>
        )}
        <button
          type="button"
          className="btn-primary step-next-btn"
          onClick={onNext}
          disabled={!isSolved}
        >
          {isLastStep ? 'Hoàn thành bài học ✓' : 'Làm tốt lắm, bước tiếp →'}
        </button>
      </div>
    </div>
  )
}
