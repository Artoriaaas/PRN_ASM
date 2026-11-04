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

