import { auth } from '../../../auth/firebase'
import { getDevToken } from '../../../auth/devAuth'
import type { AppNotification, NotificationService, NotificationType } from './types'
import { loadMockNotifications, saveMockNotifications } from './mockData'

async function getAuthToken(): Promise<string> {
  const user = auth.currentUser
  if (user) {
    try {
      return await user.getIdToken()
    } catch {
      return await getDevToken()
    }
  }
  return await getDevToken()
}

export class MockNotificationService implements NotificationService {
  async list(params: {
    cursor?: string
    limit: number
    unreadOnly?: boolean
    types?: NotificationType[]
  }): Promise<{ items: AppNotification[]; nextCursor?: string }> {
    let all = loadMockNotifications()

    // Sắp xếp mới nhất lên đầu
    all = all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Lọc theo unreadOnly
    if (params.unreadOnly) {
      all = all.filter((n) => !n.isRead)
    }

    // Lọc theo types
    if (params.types && params.types.length > 0) {
      const typeSet = new Set(params.types)
      all = all.filter((n) => typeSet.has(n.type))
    }

    let startIndex = 0
    if (params.cursor) {
      const foundIdx = all.findIndex((n) => n.id === params.cursor)
      if (foundIdx >= 0) {
        startIndex = foundIdx + 1
      }
    }

    const items = all.slice(startIndex, startIndex + params.limit)
    const nextCursor = startIndex + params.limit < all.length ? items[items.length - 1]?.id : undefined

    return { items, nextCursor }
  }

  async unreadCount(): Promise<number> {
    const all = loadMockNotifications()
    return all.filter((n) => !n.isRead).length
  }

  async markRead(id: string): Promise<void> {
    const all = loadMockNotifications()
    const target = all.find((n) => n.id === id)
    if (target) {
      target.isRead = true
      saveMockNotifications(all)
    }
  }

  async markAllRead(): Promise<void> {
    const all = loadMockNotifications()
    for (const item of all) {
      item.isRead = true
    }
    saveMockNotifications(all)
  }

  // Tiện ích dev: thêm thông báo giả lập
  addNotification(n: AppNotification): void {
    const all = loadMockNotifications()
    // Chống trùng ID
    if (!all.some((item) => item.id === n.id)) {
      all.unshift(n)
      saveMockNotifications(all)
    }
  }
}

export class ApiNotificationService implements NotificationService {
  private baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

  private async fetchWithAuth(input: string, init?: RequestInit): Promise<Response> {
    const token = await getAuthToken()
    const headers = new Headers(init?.headers)
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return fetch(input, { ...init, headers })
  }

  async list(params: {
    cursor?: string
    limit: number
    unreadOnly?: boolean
    types?: NotificationType[]
  }): Promise<{ items: AppNotification[]; nextCursor?: string }> {
    const query = new URLSearchParams()
    if (params.cursor) query.set('cursor', params.cursor)
    query.set('limit', String(params.limit))
    if (params.unreadOnly) query.set('unreadOnly', 'true')
    if (params.types && params.types.length > 0) {
      query.set('types', params.types.join(','))
    }

    const res = await this.fetchWithAuth(`${this.baseUrl}/api/notifications?${query.toString()}`)
    if (!res.ok) {
      throw new Error(`Lỗi tải danh sách thông báo (${res.status})`)
    }
    return res.json() as Promise<{ items: AppNotification[]; nextCursor?: string }>
  }

  async unreadCount(): Promise<number> {
    const res = await this.fetchWithAuth(`${this.baseUrl}/api/notifications/unread-count`)
    if (!res.ok) {
      throw new Error(`Lỗi lấy số thông báo chưa đọc (${res.status})`)
    }
    const data = (await res.json()) as { count: number }
    return data.count
  }

  async markRead(id: string): Promise<void> {
    const res = await this.fetchWithAuth(`${this.baseUrl}/api/notifications/${id}/read`, {
      method: 'POST',
    })
    if (!res.ok) {
      throw new Error(`Lỗi đánh dấu đã đọc (${res.status})`)
    }
  }

  async markAllRead(): Promise<void> {
    const res = await this.fetchWithAuth(`${this.baseUrl}/api/notifications/read-all`, {
      method: 'POST',
    })
    if (!res.ok) {
      throw new Error(`Lỗi đánh dấu tất cả đã đọc (${res.status})`)
    }
  }
}

let mockInstance: MockNotificationService | null = null
let apiInstance: ApiNotificationService | null = null

export function getNotificationService(): NotificationService {
  const mode = import.meta.env.VITE_NOTIFICATIONS_MODE ?? 'mock'
  if (mode === 'api') {
    if (!apiInstance) apiInstance = new ApiNotificationService()
    return apiInstance
  }
  if (!mockInstance) mockInstance = new MockNotificationService()
  return mockInstance
}

export function createAndPublishNotification(notification: AppNotification): void {
  const service = getNotificationService()
  if (service instanceof MockNotificationService) {
    service.addNotification(notification)
  }
  // Bắn sự kiện window để NotificationsProvider cập nhật trạng thái ngay lập tức
  window.dispatchEvent(new CustomEvent('sudoku:new-notification', { detail: notification }))
}

