import { memo } from 'react'
import { hasNote } from '../lib/board'

export type SudokuCellProps = {
  index: number
  value: number       // 0 = trống
  notesMask: number   // bitmask 9 bit
  isGiven: boolean
  isSelected: boolean
  isPeer: boolean     // cùng hàng, cột, vùng với ô được chọn
  isSameDigit: boolean
  isConflict: boolean
  isOpponentRecent: boolean // duel: đối thủ vừa điền
  borderMask: number  // top=8, right=4, bottom=2, left=1 (1=viền đậm)
  regionIndex?: number
  hintMode?: 'clue' | 'beam' | 'house' | 'target' | 'dimmed' | null
  ghostValue?: number | null
  onClick: (index: number) => void
}

function SudokuCellInner({
  index,
  value,
  notesMask,
  isGiven,
  isSelected,
  isPeer,
  isSameDigit,
  isConflict,
  isOpponentRecent,
  borderMask,
  regionIndex,
  hintMode = null,
  ghostValue = null,
  onClick,
}: SudokuCellProps) {
  const [row, col] = [Math.floor(index / 9), index % 9]

  const classNames = [
    'sudoku-cell',
    isSelected && 'is-selected',
    isPeer && !isSelected && 'is-peer',
    isSameDigit && !isSelected && 'is-same-digit',
    isConflict && 'is-conflict',
    isGiven && 'is-given',
    isOpponentRecent && 'is-opponent-recent',
    borderMask & 8 && 'border-top',
    borderMask & 4 && 'border-right',
    borderMask & 2 && 'border-bottom',
    borderMask & 1 && 'border-left',
    hintMode === 'clue' && 'is-hint-clue',
    hintMode === 'beam' && 'is-hint-beam',
    hintMode === 'house' && 'is-hint-house',
    hintMode === 'target' && 'is-hint-target',
    hintMode === 'dimmed' && 'is-hint-dimmed',
  ]
    .filter(Boolean)
    .join(' ')

  const showNotes = value === 0 && notesMask !== 0

  return (
    <div
      role="gridcell"
      data-region={regionIndex}
      aria-label={`Hàng ${row + 1}, cột ${col + 1}${value ? `, giá trị ${value}` : ', trống'}${isGiven ? ', ô đề' : ''}${isConflict ? ', xung đột' : ''}`}
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      className={classNames}
      onClick={() => onClick(index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(index)
      }}
    >
      {showNotes ? (
        <div className="cell-notes">
          {Array.from({ length: 9 }, (_, n) => (
            <span key={n + 1} className={hasNote(notesMask, n + 1) ? 'note-visible' : ''}>
              {hasNote(notesMask, n + 1) ? n + 1 : ''}
            </span>
          ))}
        </div>
      ) : value !== 0 ? (
        <span className="cell-value">{value}</span>
      ) : ghostValue ? (
        <span className="cell-value is-ghost-value">{ghostValue}</span>
      ) : null}
    </div>
  )
}

export const SudokuCell = memo(SudokuCellInner)
