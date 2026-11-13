import type { AppNotification } from './types'

const MOCK_STORAGE_KEY = 'sudoku.notifications.mock.v2'

// Bỏ dữ liệu giả mặc định theo yêu cầu — bắt đầu với danh sách rỗng (0 thông báo)
export const INITIAL_MOCK_NOTIFICATIONS: AppNotification[] = []

export function loadMockNotifications(): AppNotification[] {
  try {
    // Dọn dẹp phiên bản lưu trữ cũ v1 (nếu có trên trình duyệt của người dùng)
    localStorage.removeItem('sudoku.notifications.mock.v1')

    const raw = localStorage.getItem(MOCK_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppNotification[]
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  saveMockNotifications(INITIAL_MOCK_NOTIFICATIONS)
  return [...INITIAL_MOCK_NOTIFICATIONS]
}

export function saveMockNotifications(items: AppNotification[]): void {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Ignore storage write errors
  }
}
