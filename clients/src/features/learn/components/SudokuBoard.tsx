import { useMemo, useCallback, useEffect, useRef } from 'react'
import type { Highlight, HighlightTone } from '../types'
import { computeBorderMasks, STANDARD_REGION_MAP, indexToRC } from '../../../lib/board'

export type SudokuBoardProps = {
  cells: string // 81 ký tự: '0' hoặc '.' là ô trống, '1'..'9' là số
  givenMask?: boolean[] // 81 boolean, true là số đề cho
  regions?: string // 81 ký tự '0'..'8', mặc định khối 3x3
  highlights?: Highlight[]
  candidates?: Record<number, number[]> // ghi chú nhỏ trong ô (0-80 -> [1..9])
  selectedCell: number | null
  wrongCells?: Set<number>
  shakeCell?: number | null
  mode?: 'view' | 'fill' | 'notes'
  onCellSelect?: (index: number) => void
  onCellFill?: (index: number, digit: number) => void
  onNoteToggle?: (index: number, digit: number) => void
}

export function SudokuBoard({
  cells,
  givenMask,
  regions = STANDARD_REGION_MAP,
  highlights = [],
  candidates = {},
  selectedCell,
  wrongCells,
  shakeCell = null,
  mode = 'view',
  onCellSelect,
}: SudokuBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)

  // Tính ranh giới vùng (borderMask)
  const borderMasks = useMemo(() => computeBorderMasks(regions), [regions])

  // Tính toán highlight tone cho từng ô (0..80)
  const cellHighlights = useMemo(() => {
    const map = new Map<number, HighlightTone>()
    if (!highlights || highlights.length === 0) return map

    // Thứ tự ưu tiên tone: target > error > block > focus
    const tonePriority: Record<HighlightTone, number> = {
      target: 4,
      error: 3,
      block: 2,
      focus: 1,
    }

    for (const h of highlights) {
      const applyToCell = (idx: number) => {
        if (idx < 0 || idx >= 81) return
        const existing = map.get(idx)
        if (!existing || tonePriority[h.tone] > tonePriority[existing]) {
          map.set(idx, h.tone)
        }
      }

      if (h.type === 'cell') {
        for (const idx of h.targets) applyToCell(idx)
      } else if (h.type === 'row') {
        for (const r of h.targets) {
          for (let c = 0; c < 9; c++) applyToCell(r * 9 + c)
        }
      } else if (h.type === 'col') {
        for (const c of h.targets) {
          for (let r = 0; r < 9; r++) applyToCell(r * 9 + c)
        }
      } else if (h.type === 'region') {
        const regionSet = new Set(h.targets.map(String))
        for (let i = 0; i < 81; i++) {
          if (regionSet.has(regions[i])) applyToCell(i)
        }
      } else if (h.type === 'number') {
        const numSet = new Set(h.targets.map(String))
        for (let i = 0; i < 81; i++) {
          if (numSet.has(cells[i])) applyToCell(i)
        }
      }
    }

    return map
  }, [highlights, regions, cells])

  const isIrregular = regions !== STANDARD_REGION_MAP

  const handleCellClick = useCallback(
    (idx: number) => {
      onCellSelect?.(idx)
    },
    [onCellSelect],
  )

  // Điều hướng bằng phím mũi tên
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (selectedCell === null) return
      const { key } = e
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault()
        const [r, c] = indexToRC(selectedCell)
        let next = selectedCell
        if (key === 'ArrowUp' && r > 0) next = selectedCell - 9
        else if (key === 'ArrowDown' && r < 8) next = selectedCell + 9
        else if (key === 'ArrowLeft' && c > 0) next = selectedCell - 1
        else if (key === 'ArrowRight' && c < 8) next = selectedCell + 1
        onCellSelect?.(next)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCell, onCellSelect])

  return (
    <div
      ref={boardRef}
      className={`learn-board sudoku-board${isIrregular ? ' is-irregular' : ''}`}
      role="grid"
      aria-label="Bàn Sudoku bài học"
      data-mode={mode}
    >
      {Array.from({ length: 81 }, (_, i) => {
        const rawVal = cells[i]
        const isBlank = !rawVal || rawVal === '0' || rawVal === '.'
        const value = isBlank ? '' : rawVal
        const isGiven = givenMask ? Boolean(givenMask[i]) : isBlank ? false : true
        const isSelected = selectedCell === i
        const isWrong = wrongCells?.has(i) || shakeCell === i
        const tone = cellHighlights.get(i)
        const cellCandidates = candidates[i] || []
        const mask = borderMasks[i]
        const [row, col] = indexToRC(i)

        const classList = [
          'sudoku-cell',
          'learn-cell',
          isGiven && 'is-given',
          !isGiven && value && 'is-user-filled',
          isSelected && 'is-selected',
          isWrong && 'is-conflict',
          shakeCell === i && 'is-shaking',
          tone && `tone-${tone}`,
          mask & 8 && 'border-top',
          mask & 4 && 'border-right',
          mask & 2 && 'border-bottom',
          mask & 1 && 'border-left',
        ]
          .filter(Boolean)
          .join(' ')

        const accessibleLabel = `Hàng ${row + 1}, cột ${col + 1}${
          value ? `, số ${value}` : ', ô trống'
        }${isGiven ? ', số đề' : ''}${tone ? `, trạng thái ${tone}` : ''}`

        return (
          <div
            key={i}
            role="gridcell"
            data-region={regions[i]}
            aria-label={accessibleLabel}
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            className={classList}
            onClick={() => handleCellClick(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleCellClick(i)
              }
            }}
          >
            {value ? (
              <span className="cell-value">{value}</span>
            ) : cellCandidates.length > 0 ? (
              <div className="cell-notes" aria-hidden="true">
                {Array.from({ length: 9 }, (_, d) => {
                  const num = d + 1
                  const has = cellCandidates.includes(num)
                  return (
                    <span key={num} className={has ? 'note-visible' : ''}>
                      {has ? num : ''}
                    </span>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

