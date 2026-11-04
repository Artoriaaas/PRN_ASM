import { useMemo, useCallback, useEffect, useRef } from 'react'
import { SudokuCell } from './SudokuCell'
import {
  computeBorderMasks,
  getPeers,
  findConflicts,
  STANDARD_REGION_MAP,
} from '../lib/board'

export type SudokuBoardProps = {
  initial: string         // 81 chars, '0' = trống
  cells: Uint8Array       // giá trị hiện tại
  notes: Uint16Array      // bitmask ghi chú
  regionMap?: string      // 81 chars, mặc định standard
  selected: number | null
  recentOpponentCell?: number | null  // duel
  readOnly?: boolean
  onSelect: (index: number) => void
}

export function SudokuBoard({
  initial,
  cells,
  notes,
  regionMap = STANDARD_REGION_MAP,
  selected,
  recentOpponentCell = null,
  readOnly = false,
  onSelect,
}: SudokuBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)

  // Tính một lần từ regionMap
  const borderMasks = useMemo(() => computeBorderMasks(regionMap), [regionMap])
  const conflicts = useMemo(() => findConflicts(cells, regionMap), [cells, regionMap])
  const peers = useMemo(
    () => (selected !== null ? getPeers(selected, regionMap) : new Set<number>()),
    [selected, regionMap],
  )
  const selectedValue = selected !== null ? cells[selected] : 0

  const handleSelect = useCallback(
    (index: number) => {
      if (!readOnly) onSelect(index)
    },
    [readOnly, onSelect],
  )

  // Keyboard navigation: arrow keys, số, Backspace
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (selected === null) return
      const { key } = e

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault()
        const [row, col] = [Math.floor(selected / 9), selected % 9]
        let next = selected
        if (key === 'ArrowUp' && row > 0) next = selected - 9
        else if (key === 'ArrowDown' && row < 8) next = selected + 9
        else if (key === 'ArrowLeft' && col > 0) next = selected - 1
        else if (key === 'ArrowRight' && col < 8) next = selected + 1
        onSelect(next)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selected, onSelect])

  return (
    <div
      ref={boardRef}
      className="sudoku-board"
      role="grid"
      aria-label="Bàn Sudoku 9x9"
    >
      {Array.from({ length: 81 }, (_, i) => (
        <SudokuCell
          key={i}
          index={i}
          value={cells[i]}
          notesMask={notes[i]}
          isGiven={initial[i] !== '0'}
          isSelected={selected === i}
          isPeer={peers.has(i)}
          isSameDigit={selectedValue !== 0 && cells[i] === selectedValue}
          isConflict={conflicts.has(i)}
          isOpponentRecent={recentOpponentCell === i}
          borderMask={borderMasks[i]}
          onClick={handleSelect}
        />
      ))}
    </div>
  )
}

