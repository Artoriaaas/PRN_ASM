export type StepExplainProps = {
  title: string
  body: string
  canGoBack: boolean
  canGoNext: boolean
  isLastStep: boolean
  onNext: () => void
  onPrev: () => void
}

export function StepExplain({
  title,
  body,
  canGoBack,
  canGoNext,
  isLastStep,
  onNext,
  onPrev,
}: StepExplainProps) {
  // Tách các đoạn văn bản để render mượt mà
  const paragraphs = body.split('\n\n').filter(Boolean)

  return (
    <div className="step-explain-pane">
      <div className="step-badge">LÝ THUYẾT VÀ VÍ DỤ</div>
      <h2 className="step-title">{title}</h2>

      <div className="step-body-content">
        {paragraphs.map((p, idx) => {
          if (p.trim().startsWith('- ') || p.trim().startsWith('* ')) {
            const items = p
              .split('\n')
              .map((line) => line.replace(/^[-*]\s*/, '').trim())
              .filter(Boolean)
            return (
              <ul key={idx} className="step-list">
                {items.map((item, itemIdx) => (
                  <li key={itemIdx}>{item}</li>
                ))}
              </ul>
            )
          }
          return <p key={idx} className="step-paragraph">{p}</p>
        })}
      </div>

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
          disabled={!canGoNext}
        >
          {isLastStep ? 'Hoàn thành bài học ✓' : 'Đã hiểu, bước tiếp →'}
        </button>
      </div>
    </div>
  )
}

