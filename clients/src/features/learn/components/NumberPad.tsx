import { useEffect } from 'react'

export type NumberPadProps = {
  disabled?: boolean
  isNoteMode?: boolean
  showNoteToggle?: boolean
  onInput: (digit: number) => void
  onErase: () => void
  onToggleNoteMode?: () => void
}

export function NumberPad({
  disabled = false,
  isNoteMode = false,
  showNoteToggle = true,
  onInput,
  onErase,
  onToggleNoteMode,
}: NumberPadProps) {
  // Bắt phím số 1-9, Backspace, Delete và phím N để bật/tắt ghi chú
  useEffect(() => {
    if (disabled) return

    function handleKeyDown(e: KeyboardEvent) {
      // Bỏ qua nếu đang focus vào input hoặc textarea
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return
      }

      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        onInput(parseInt(e.key, 10))
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        onErase()
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        onToggleNoteMode?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [disabled, onInput, onErase, onToggleNoteMode])

  return (
    <div className="learn-numpad" role="toolbar" aria-label="Bàn phím nhập số">
      <div className="learn-numpad-digits">
        {Array.from({ length: 9 }, (_, i) => {
          const digit = i + 1
          return (
            <button
              key={digit}
              type="button"
              className="learn-numpad-btn digit-btn"
              disabled={disabled}
              onClick={() => onInput(digit)}
              aria-label={`Điền số ${digit}`}
            >
              {digit}
            </button>
          )
        })}
      </div>

      <div className="learn-numpad-actions">
        {showNoteToggle && onToggleNoteMode && (
          <button
            type="button"
            className={`learn-numpad-btn action-btn note-btn${isNoteMode ? ' is-active' : ''}`}
            disabled={disabled}
            onClick={onToggleNoteMode}
            aria-pressed={isNoteMode}
            aria-label={isNoteMode ? 'Tắt chế độ ghi chú (phím N)' : 'Bật chế độ ghi chú (phím N)'}
          >
            <span className="btn-icon" aria-hidden="true">✏️</span>
            <span>Ghi chú {isNoteMode ? '(BẬT)' : ''}</span>
          </button>
        )}

        <button
          type="button"
          className="learn-numpad-btn action-btn erase-btn"
          disabled={disabled}
          onClick={onErase}
          aria-label="Xóa giá trị hoặc ghi chú (Backspace)"
        >
          <span className="btn-icon" aria-hidden="true">⌫</span>
          <span>Xóa</span>
        </button>
      </div>
    </div>
  )
}

