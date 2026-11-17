import { countDigit } from '../lib/board'

export type NumberPadProps = {
  cells: Uint8Array
  notesMode: boolean
  showHint?: boolean          // chỉ solo
  onNumber: (n: number) => void
  onDelete: () => void
  onToggleNotes: () => void
  onHint?: () => void
  disabled?: boolean
}

export function NumberPad({
  cells,
  notesMode,
  showHint = false,
  onNumber,
  onDelete,
  onToggleNotes,
  onHint,
  disabled = false,
}: NumberPadProps) {
  return (
    <div className="number-pad" aria-label="Bàn phím số Sudoku">
      <div className="number-pad-grid">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
          const filled = countDigit(cells, n)
          const exhausted = filled >= 9
          return (
            <button
              key={n}
              type="button"
              className={`pad-num${exhausted ? ' exhausted' : ''}`}
              onClick={() => onNumber(n)}
              disabled={disabled || exhausted}
              aria-label={`Điền số ${n}${exhausted ? ' (đã đủ 9)' : ''}`}
            >
              {n}
              {filled > 0 && (
                <span className="pad-num-count" aria-hidden="true">
                  {9 - filled}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="number-pad-actions">
        <button
          type="button"
          className="pad-action"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Xóa ô"
        >
          <span aria-hidden="true">⌫</span>
          Xóa
        </button>

        <button
          type="button"
          className={`pad-action${notesMode ? ' active' : ''}`}
          onClick={onToggleNotes}
          disabled={disabled}
          aria-label={notesMode ? 'Tắt ghi chú' : 'Bật ghi chú'}
          aria-pressed={notesMode}
        >
          <span aria-hidden="true">✎</span>
          {notesMode ? 'Ghi chú ✓' : 'Ghi chú'}
        </button>

        {showHint && (
          <button
            type="button"
            className="pad-action hint"
            onClick={onHint}
            disabled={disabled}
            aria-label="Gợi ý (H)"
          >
            <span aria-hidden="true">💡</span>
            Gợi ý
          </button>
        )}
      </div>
    </div>
  )
}

