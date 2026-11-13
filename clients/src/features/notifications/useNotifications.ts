import { createContext, useContext } from 'react'
import type { AppNotification } from './services/types'

export interface NotificationsContextValue {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  error: string | null
  hasPendingInvite: boolean
  latestInviteToast: AppNotification | null
  isSoundEnabled: boolean
  toggleSound: () => void
  refreshUnreadCount: () => Promise<void>
  fetchRecent: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  respondToInvite: (inviteId: string, accept: boolean) => Promise<{ roomCode?: string }>
  dismissToast: () => void
  // Dev helpers
  simulateInvite: () => void
  simulateEloGain: () => void
  simulateLessonComplete: () => void
  simulateTenNotifications: () => void
  clearAllNotifications: () => void
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications phải được sử dụng bên trong NotificationsProvider')
  }
  return context
}

