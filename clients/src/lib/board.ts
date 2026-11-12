/**
 * board.ts — tất cả logic client-side về bàn Sudoku.
 * Không nhân bản luật kiểm tra của server ngoài phần hiển thị xung đột.
 */

/** Chuyển index phẳng (0-80) thành [row, col] */
export function indexToRC(index: number): [number, number] {
  return [Math.floor(index / 9), index % 9];
}

/** Chuyển [row, col] thành index phẳng */
export function rcToIndex(row: number, col: number): number {
  return row * 9 + col;
}

/**
 * Tính tập hợp "peer" của một ô: tất cả ô cùng hàng, cột, hoặc vùng (regionMap).
 * Trả về Set<number> gồm 20 ô (không tính ô gốc).
 */
export function getPeers(index: number, regionMap: string): Set<number> {
  const [row, col] = indexToRC(index);
  const region = regionMap[index];
  const peers = new Set<number>();

  for (let i = 0; i < 81; i++) {
    if (i === index) continue;
    const [r, c] = indexToRC(i);
    if (r === row || c === col || regionMap[i] === region) {
      peers.add(i);
    }
  }

  return peers;
}

/**
 * Tính borderMask cho mỗi ô: bitmask 4 bit (top=8, right=4, bottom=2, left=1).
 * Bit = 1 → viền ĐẬM (khác vùng với ô kề); bit = 0 → viền mỏng (cùng vùng).
 * Dùng useMemo, tính một lần từ regionMap.
 */
export function computeBorderMasks(regionMap: string): Uint8Array {
  const masks = new Uint8Array(81);

  for (let i = 0; i < 81; i++) {
    const [row, col] = indexToRC(i);
    let mask = 0;

    // top
    if (row === 0 || regionMap[i] !== regionMap[rcToIndex(row - 1, col)]) mask |= 8;
    // right
    if (col === 8 || regionMap[i] !== regionMap[rcToIndex(row, col + 1)]) mask |= 4;
    // bottom
    if (row === 8 || regionMap[i] !== regionMap[rcToIndex(row + 1, col)]) mask |= 2;
    // left
    if (col === 0 || regionMap[i] !== regionMap[rcToIndex(row, col - 1)]) mask |= 1;

    masks[i] = mask;
  }

  return masks;
}

/** RegionMap mặc định cho layout standard (khối 3x3) */
export const STANDARD_REGION_MAP = Array.from({ length: 81 }, (_, i) => {
  const [row, col] = indexToRC(i);
  return String(Math.floor(row / 3) * 3 + Math.floor(col / 3));
}).join('');

/**
 * Phát hiện xung đột client-side (chỉ để hiển thị, server mới là nơi quyết định).
 * Trả về Set<number> gồm các ô có giá trị trùng với ô khác trong cùng peer group.
 */
export function findConflicts(cells: Uint8Array, regionMap: string): Set<number> {
  const conflicts = new Set<number>();

  for (let i = 0; i < 81; i++) {
    const v = cells[i];
    if (v === 0) continue;

    const [row, col] = indexToRC(i);
    const region = regionMap[i];

    for (let j = i + 1; j < 81; j++) {
      if (cells[j] !== v) continue;
      const [r, c] = indexToRC(j);
      if (r === row || c === col || regionMap[j] === region) {
        conflicts.add(i);
        conflicts.add(j);
      }
    }
  }

  return conflicts;
}

/** Bitmask ghi chú: bật/tắt số n (1-9) */
export function toggleNote(mask: number, n: number): number {
  return mask ^ (1 << (n - 1));
}

export function hasNote(mask: number, n: number): boolean {
  return (mask & (1 << (n - 1))) !== 0;
}

/** Đếm số lần xuất hiện của value trong cells */
export function countDigit(cells: Uint8Array, value: number): number {
  let count = 0;
  for (let i = 0; i < 81; i++) {
    if (cells[i] === value) count++;
  }
  return count;
}

/** Kiểm tra bàn đã điền đủ chưa (không còn ô 0) */
export function isBoardFilled(cells: Uint8Array): boolean {
  for (let i = 0; i < 81; i++) {
    if (cells[i] === 0) return false;
  }
  return true;
}

export type LogicalHintResult = {
  targetIdx: number
  value: number
  technique: 'HiddenSingleRegion' | 'HiddenSingleRow' | 'HiddenSingleCol' | 'NakedSingle' | 'DirectReveal'
  techniqueTitle: string
  step1Text: string
  step2Text: string
  step3Text: string
  clueCells: number[]
  beamCells: number[]
  houseCells: number[]
  selectedHasNoEvidence?: boolean
}

export function getCandidates(cells: Uint8Array, regionMap: string, idx: number): number[] {
  if (cells[idx] !== 0) return []
  const peers = getPeers(idx, regionMap)
  const used = new Set<number>()
  for (const p of peers) {
    if (cells[p] !== 0) used.add(cells[p])
  }
  const candidates: number[] = []
  for (let v = 1; v <= 9; v++) {
    if (!used.has(v)) candidates.push(v)
  }
  return candidates
}

export function findLogicalHint(
  cells: Uint8Array,
  regionMap: string,
  preferredIdx: number | null = null,
  solution?: string,
): LogicalHintResult | null {
  const rows: number[][] = Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => r * 9 + c),
  )
  const cols: number[][] = Array.from({ length: 9 }, (_, c) =>
    Array.from({ length: 9 }, (_, r) => r * 9 + c),
  )
  const regions: number[][] = Array.from({ length: 9 }, () => [])
  for (let i = 0; i < 81; i++) {
    regions[Number(regionMap[i])].push(i)
  }

  const getCellsWithValue = (v: number) => {
    const res: number[] = []
    for (let i = 0; i < 81; i++) {
      if (cells[i] === v) res.push(i)
    }
    return res
  }

  const getBeamsForClues = (clueIndices: number[]) => {
    const beamSet = new Set<number>()
    for (const c of clueIndices) {
      const [r, col] = indexToRC(c)
      for (let i = 0; i < 9; i++) {
        beamSet.add(r * 9 + i)
        beamSet.add(i * 9 + col)
      }
    }
    return Array.from(beamSet)
  }

  let selectedHasNoEvidence = false
  if (
    preferredIdx !== null &&
    preferredIdx >= 0 &&
    preferredIdx < 81 &&
    cells[preferredIdx] === 0
  ) {
    const prefCandidates = getCandidates(cells, regionMap, preferredIdx)
    if (prefCandidates.length > 1) {
      const [prefR, prefC] = indexToRC(preferredIdx)
      const prefReg = Number(regionMap[preferredIdx])

      for (const v of prefCandidates) {
        const inReg = regions[prefReg].filter(
          (c) => cells[c] === 0 && getCandidates(cells, regionMap, c).includes(v),
        )
        if (inReg.length === 1 && inReg[0] === preferredIdx) {
          const clues = getCellsWithValue(v)
          return {
            targetIdx: preferredIdx,
            value: v,
            technique: 'HiddenSingleRegion',
            techniqueTitle: 'Hidden Single (Khối)',
            step1Text: 'Quan sát các ô manh mối và các vùng chiếu loại trừ',
            step2Text: `Trong khối này, chỉ còn duy nhất một ô có thể chứa số ${v}`,
            step3Text: `Vì là vị trí duy nhất còn lại, ô này bắt buộc phải là ${v}`,
            clueCells: clues,
            beamCells: getBeamsForClues(clues),
            houseCells: regions[prefReg],
          }
        }

        const inRow = rows[prefR].filter(
          (c) => cells[c] === 0 && getCandidates(cells, regionMap, c).includes(v),
        )
        if (inRow.length === 1 && inRow[0] === preferredIdx) {
          const clues = getCellsWithValue(v)
          return {
            targetIdx: preferredIdx,
            value: v,
            technique: 'HiddenSingleRow',
            techniqueTitle: 'Hidden Single (Hàng)',
            step1Text: 'Quan sát các ô manh mối và các cột chiếu loại trừ',
            step2Text: `Trong hàng này, chỉ còn duy nhất một ô có thể chứa số ${v}`,
            step3Text: `Vì là vị trí duy nhất còn lại, ô này bắt buộc phải là ${v}`,
            clueCells: clues,
            beamCells: getBeamsForClues(clues),
            houseCells: rows[prefR],
          }
        }

        const inCol = cols[prefC].filter(
          (c) => cells[c] === 0 && getCandidates(cells, regionMap, c).includes(v),
        )
        if (inCol.length === 1 && inCol[0] === preferredIdx) {
          const clues = getCellsWithValue(v)
          return {
            targetIdx: preferredIdx,
            value: v,
            technique: 'HiddenSingleCol',
            techniqueTitle: 'Hidden Single (Cột)',
            step1Text: 'Quan sát các ô manh mối và các hàng chiếu loại trừ',
            step2Text: `Trong cột này, chỉ còn duy nhất một ô có thể chứa số ${v}`,
            step3Text: `Vì là vị trí duy nhất còn lại, ô này bắt buộc phải là ${v}`,
            clueCells: clues,
            beamCells: getBeamsForClues(clues),
            houseCells: cols[prefC],
          }
        }
      }

      selectedHasNoEvidence = true
    } else if (prefCandidates.length === 1) {
      const v = prefCandidates[0]
      const peerList = Array.from(getPeers(preferredIdx, regionMap)).filter(
        (p) => cells[p] !== 0,
      )
      return {
        targetIdx: preferredIdx,
        value: v,
        technique: 'NakedSingle',
        techniqueTitle: 'Naked Single (Độc nhất)',
        step1Text: 'Quan sát các ô đã điền cùng hàng, cột và khối của ô mục tiêu',
        step2Text: `Tất cả 8 số khác (1–9 trừ số ${v}) đã xuất hiện ở hàng, cột hoặc khối giao cắt. Ô này không thể chứa số nào khác`,
        step3Text: `Vì không còn lựa chọn nào khác, ô này bắt buộc phải là ${v}`,
        clueCells: peerList,
        beamCells: peerList,
        houseCells: [preferredIdx],
      }
    }
  }

  // 1. Hidden Single in Region (Block) — most intuitive (Image 2, 3, 4)
  for (let reg = 0; reg < 9; reg++) {
    const house = regions[reg]
    for (let v = 1; v <= 9; v++) {
      if (house.some((c) => cells[c] === v)) continue
      const available = house.filter(
        (c) => cells[c] === 0 && getCandidates(cells, regionMap, c).includes(v),
      )
      if (available.length === 1) {
        const target = available[0]
        const clues = getCellsWithValue(v)
        return {
          targetIdx: target,
          value: v,
          technique: 'HiddenSingleRegion',
          techniqueTitle: 'Hidden Single (Khối)',
          step1Text: 'Quan sát các ô manh mối và các vùng chiếu loại trừ',
          step2Text: `Trong khối này, chỉ còn duy nhất một ô có thể chứa số ${v}`,
          step3Text: `Vì là vị trí duy nhất còn lại, ô này bắt buộc phải là ${v}`,
          clueCells: clues,
          beamCells: getBeamsForClues(clues),
          houseCells: house,
          selectedHasNoEvidence,
        }
      }
    }
  }

  // 2. Naked Single
  for (let i = 0; i < 81; i++) {
    if (cells[i] !== 0) continue
    const candidates = getCandidates(cells, regionMap, i)
    if (candidates.length === 1) {
      const v = candidates[0]
      const peerList = Array.from(getPeers(i, regionMap)).filter(
        (p) => cells[p] !== 0,
      )
      return {
        targetIdx: i,
        value: v,
        technique: 'NakedSingle',
        techniqueTitle: 'Naked Single (Độc nhất)',
        step1Text: 'Quan sát các ô đã điền cùng hàng, cột và khối của ô mục tiêu',
        step2Text: `Tất cả 8 số khác (1–9 trừ số ${v}) đã xuất hiện ở hàng, cột hoặc khối giao cắt. Ô này không thể chứa số nào khác`,
        step3Text: `Vì không còn lựa chọn nào khác, ô này bắt buộc phải là ${v}`,
        clueCells: peerList,
        beamCells: peerList,
        houseCells: [i],
        selectedHasNoEvidence,
      }
    }
  }

  // 3. Hidden Single in Row
  for (let r = 0; r < 9; r++) {
    const house = rows[r]
    for (let v = 1; v <= 9; v++) {
      if (house.some((c) => cells[c] === v)) continue
      const available = house.filter(
        (c) => cells[c] === 0 && getCandidates(cells, regionMap, c).includes(v),
      )
      if (available.length === 1) {
        const target = available[0]
        const clues = getCellsWithValue(v)
        return {
          targetIdx: target,
          value: v,
          technique: 'HiddenSingleRow',
          techniqueTitle: 'Hidden Single (Hàng)',
          step1Text: 'Quan sát các ô manh mối và các cột chiếu loại trừ',
          step2Text: `Trong hàng này, chỉ còn duy nhất một ô có thể chứa số ${v}`,
          step3Text: `Vì là vị trí duy nhất còn lại, ô này bắt buộc phải là ${v}`,
          clueCells: clues,
          beamCells: getBeamsForClues(clues),
          houseCells: house,
          selectedHasNoEvidence,
        }
      }
    }
  }

  // 4. Hidden Single in Column
  for (let c = 0; c < 9; c++) {
    const house = cols[c]
    for (let v = 1; v <= 9; v++) {
      if (house.some((idx) => cells[idx] === v)) continue
      const available = house.filter(
        (idx) => cells[idx] === 0 && getCandidates(cells, regionMap, idx).includes(v),
      )
      if (available.length === 1) {
        const target = available[0]
        const clues = getCellsWithValue(v)
        return {
          targetIdx: target,
          value: v,
          technique: 'HiddenSingleCol',
          techniqueTitle: 'Hidden Single (Cột)',
          step1Text: 'Quan sát các ô manh mối và các hàng chiếu loại trừ',
          step2Text: `Trong cột này, chỉ còn duy nhất một ô có thể chứa số ${v}`,
          step3Text: `Vì là vị trí duy nhất còn lại, ô này bắt buộc phải là ${v}`,
          clueCells: clues,
          beamCells: getBeamsForClues(clues),
          houseCells: house,
          selectedHasNoEvidence,
        }
      }
    }
  }

  // 5. Fallback if solution is available
  if (solution) {
    let minCand = 10
    let bestIdx = -1
    for (let i = 0; i < 81; i++) {
      if (cells[i] !== 0) continue
      const count = getCandidates(cells, regionMap, i).length
      if (count < minCand) {
        minCand = count
        bestIdx = i
      }
    }
    if (bestIdx >= 0) {
      const v = Number(solution[bestIdx])
      return {
        targetIdx: bestIdx,
        value: v,
        technique: 'DirectReveal',
        techniqueTitle: 'Tiết lộ trực tiếp',
        step1Text: 'Quan sát ô này có số lượng ứng viên tiềm năng ít nhất',
        step2Text: `Dựa trên lời giải của bàn cờ, ô này có giá trị xác định là ${v}`,
        step3Text: `Điền số ${v} vào ô này`,
        clueCells: [bestIdx],
        beamCells: [],
        houseCells: [bestIdx],
        selectedHasNoEvidence,
      }
    }
  }

  return null
}

