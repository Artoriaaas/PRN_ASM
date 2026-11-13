export type HighlightTone = 'focus' | 'block' | 'target' | 'error'
export type HighlightType = 'row' | 'col' | 'region' | 'cell' | 'number'

export type Highlight = {
  type: HighlightType
  targets: number[] // chỉ số hàng/cột/vùng (0-8), ô (0-80) hoặc chữ số (1-9)
  tone: HighlightTone
}

export type BoardSpec = {
  cells: string // 81 ký tự ('0' hoặc '.' là trống, '1'..'9' là số)
  regions?: string // 81 ký tự '0'..'8' cho biến thể Shuffle, nếu thiếu dùng chuẩn 3x3
  candidates?: Record<number, number[]> // ghi chú ứng viên theo index ô
}

export type ExerciseTask =
  | { type: 'fill-cell'; answers: Record<number, number> } // điền đúng các ô chỉ định (index -> giá trị)
  | { type: 'pick-cell'; correctCell: number } // bấm đúng ô đích
  | { type: 'pick-candidates'; cell: number; correct: number[] } // chọn đủ ứng viên cho một ô
  | { type: 'eliminate'; number: number; blockedCells: number[] } // bấm các ô bị chặn bởi một số

export type Step =
  | {
      kind: 'explain'
      title: string
      body: string
      board?: BoardSpec
      highlights?: Highlight[]
    }
  | {
      kind: 'exercise'
      title: string
      prompt: string
      board: BoardSpec
      task: ExerciseTask
      hints: string[]
      successMessage: string
      answerExplanation?: string
    }

export type Lesson = {
  code: string
  order: number
  title: string
  summary: string
  minutes: number
  steps: Step[]
}

export type LessonProgress = {
  completedAt: string
}

export interface LessonProgressStore {
  getAll(): Promise<Record<string, LessonProgress>>
  markCompleted(lessonCode: string): Promise<void>
  reset(): Promise<void>
}

