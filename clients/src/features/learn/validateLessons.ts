import type { Lesson } from './types'
import { STANDARD_REGION_MAP, indexToRC } from '../../lib/board'

export type ValidationResult = {
  valid: boolean
  errors: string[]
}

/**
 * Kiểm tra tính hợp lệ của toàn bộ dữ liệu 7 bài học:
 * - Chuỗi ô có đúng 81 ký tự
 * - Chuỗi regions (nếu có) có đúng 81 ký tự và mỗi vùng có đúng 9 ô
 * - Các số đã đặt không bị trùng lặp trong cùng hàng, cột, vùng (trừ bước bài tập cố tình tìm lỗi)
 * - Các đáp án bài tập nằm trong phạm vi 0-80 và không gây xung đột
 */
export function validateLessons(lessons: Lesson[]): ValidationResult {
  const errors: string[] = []

  lessons.forEach((lesson, lIdx) => {
    if (!lesson.code) errors.push(`Bài ${lIdx + 1} thiếu mã (code)`)
    if (!lesson.title) errors.push(`Bài ${lIdx + 1} thiếu tiêu đề (title)`)
    if (lesson.steps.length < 4) {
      errors.push(`Bài ${lesson.code} cần ít nhất 4 bước (hiện có ${lesson.steps.length})`)
    }

    lesson.steps.forEach((step, sIdx) => {
      const stepId = `Bài "${lesson.code}" - Bước ${sIdx + 1} ("${step.title}")`

      const board = step.board
      if (board) {
        if (!board.cells || board.cells.length !== 81) {
          errors.push(`${stepId}: cells phải có đúng 81 ký tự (hiện có ${board.cells?.length || 0})`)
          return
        }

        const regions = board.regions || STANDARD_REGION_MAP
        if (regions.length !== 81) {
          errors.push(`${stepId}: regions phải có đúng 81 ký tự`)
          return
        }

        // Kiểm tra mỗi region có đúng 9 ô
        const regionCounts: Record<string, number> = {}
        for (let i = 0; i < 81; i++) {
          const r = regions[i]
          regionCounts[r] = (regionCounts[r] || 0) + 1
        }
        for (let r = 0; r < 9; r++) {
          const key = String(r)
          if (regionCounts[key] !== 9) {
            errors.push(`${stepId}: Vùng ${key} có ${regionCounts[key] || 0} ô (phải đúng 9 ô)`)
          }
        }

        // Bỏ qua kiểm tra trùng hàng/cột cho bước bài tập tìm số trùng lặp trong bài Luật chơi
        const isDuplicateTest =
          step.kind === 'exercise' &&
          step.task.type === 'pick-cell' &&
          lesson.code === 'rules'

        if (!isDuplicateTest) {
          // Kiểm tra không có xung đột giữa các số đã đặt
          for (let i = 0; i < 81; i++) {
            const v = board.cells[i]
            if (!v || v === '0' || v === '.') continue

            const [r1, c1] = indexToRC(i)
            const reg1 = regions[i]

            for (let j = i + 1; j < 81; j++) {
              if (board.cells[j] !== v) continue
              const [r2, c2] = indexToRC(j)
              const reg2 = regions[j]

              if (r1 === r2) {
                errors.push(`${stepId}: Xung đột số ${v} cùng hàng ${r1 + 1} ở ô ${i} và ${j}`)
              }
              if (c1 === c2) {
                errors.push(`${stepId}: Xung đột số ${v} cùng cột ${c1 + 1} ở ô ${i} và ${j}`)
              }
              if (reg1 === reg2) {
                errors.push(`${stepId}: Xung đột số ${v} cùng vùng ${reg1} ở ô ${i} và ${j}`)
              }
            }
          }
        }
      }

      // Kiểm tra tính hợp lệ của task bài tập
      if (step.kind === 'exercise') {
        const { task } = step
        if (task.type === 'fill-cell') {
          for (const [cellStr, ans] of Object.entries(task.answers)) {
            const cell = Number(cellStr)
            if (cell < 0 || cell >= 81) {
              errors.push(`${stepId}: cell ${cell} trong answers ngoài phạm vi 0-80`)
            }
            if (ans < 1 || ans > 9) {
              errors.push(`${stepId}: đáp án ${ans} cho ô ${cell} ngoài phạm vi 1-9`)
            }
            // Kiểm tra xem điền đáp án vào có gây xung đột không
            if (board) {
              const testCells = board.cells.split('')
              testCells[cell] = String(ans)
              const [r1, c1] = indexToRC(cell)
              const reg1 = (board.regions || STANDARD_REGION_MAP)[cell]

              for (let j = 0; j < 81; j++) {
                if (j === cell) continue
                if (testCells[j] !== String(ans)) continue
                const [r2, c2] = indexToRC(j)
                const reg2 = (board.regions || STANDARD_REGION_MAP)[j]

                if (r1 === r2 || c1 === c2 || reg1 === reg2) {
                  errors.push(
                    `${stepId}: Đáp án ${ans} ở ô ${cell} xung đột với ô ${j} đã có số ${ans}`,
                  )
                }
              }
            }
          }
        } else if (task.type === 'pick-cell') {
          if (task.correctCell < 0 || task.correctCell >= 81) {
            errors.push(`${stepId}: correctCell ${task.correctCell} ngoài phạm vi 0-80`)
          }
        } else if (task.type === 'pick-candidates') {
          if (task.cell < 0 || task.cell >= 81) {
            errors.push(`${stepId}: cell ${task.cell} ngoài phạm vi 0-80`)
          }
          if (!task.correct || task.correct.length === 0) {
            errors.push(`${stepId}: pick-candidates thiếu mảng correct`)
          }
        } else if (task.type === 'eliminate') {
          if (task.number < 1 || task.number > 9) {
            errors.push(`${stepId}: số eliminate ${task.number} ngoài phạm vi 1-9`)
          }
          for (const b of task.blockedCells) {
            if (b < 0 || b >= 81) {
              errors.push(`${stepId}: blockedCell ${b} ngoài phạm vi 0-80`)
            }
          }
        }
      }
    })
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

