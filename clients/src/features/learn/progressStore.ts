import type { LessonProgress, LessonProgressStore } from './types'

const STORAGE_KEY = 'sudoku.lessonProgress.v1'

export class LocalStorageProgressStore implements LessonProgressStore {
  async getAll(): Promise<Record<string, LessonProgress>> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, LessonProgress>
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch (e) {
      console.warn('Không thể đọc tiến độ bài học từ localStorage:', e)
      return {}
    }
  }

  async markCompleted(lessonCode: string): Promise<void> {
    try {
      const current = await this.getAll()
      current[lessonCode] = { completedAt: new Date().toISOString() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    } catch (e) {
      console.warn('Không thể lưu tiến độ bài học vào localStorage:', e)
    }
  }

  async reset(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.warn('Không thể đặt lại tiến độ bài học trong localStorage:', e)
    }
  }
}

/**
 * ApiProgressStore: Chuẩn bị sẵn để tích hợp backend Game Service khi có API
 * Tương ứng bảng lesson_progress(user_id, lesson_code, completed_at)
 */
export class ApiProgressStore implements LessonProgressStore {
  constructor(private readonly baseUrl: string = '/api') {}

  async getAll(): Promise<Record<string, LessonProgress>> {
    const res = await fetch(`${this.baseUrl}/lessons/progress`, {
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error('Không thể tải tiến độ từ máy chủ')
    return res.json()
  }

  async markCompleted(lessonCode: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/lessons/${encodeURIComponent(lessonCode)}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error('Không thể cập nhật tiến độ lên máy chủ')
  }

  async reset(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/lessons/progress/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error('Không thể đặt lại tiến độ trên máy chủ')
  }
}

export const defaultProgressStore: LessonProgressStore = new LocalStorageProgressStore()

