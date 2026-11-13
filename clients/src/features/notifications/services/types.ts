export type NotificationType =
  | 'LESSON_COMPLETED'
  | 'COURSE_COMPLETED'
  | 'ELO_CHANGED'
  | 'TIER_CHANGED'
  | 'MATCH_INVITE'
  | 'TASK_COMPLETED'
  | 'CHAMPIONSHIP_UPDATE'
  | 'FEEDBACK_REPLY'
  | 'ANNOUNCEMENT'
  | 'WELCOME'
  | 'ACCOUNT'

export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED'

export type NotificationPayload =
  | { type: 'LESSON_COMPLETED'; lessonCode: string; order: number; total: number; nextLessonCode?: string }
  | { type: 'COURSE_COMPLETED' }
  | { type: 'ELO_CHANGED'; delta: number; oldElo: number; newElo: number; source: 'SOLO' | 'MULTI'; sourceId: string }
  | { type: 'TIER_CHANGED'; oldTier: string; newTier: string; direction: 'UP' | 'DOWN' }
  | {
      type: 'MATCH_INVITE'
      inviteId: string
      fromUserId: string
      fromName: string
      fromAvatarUrl?: string
      variant: 'CLASSIC' | 'SHUFFLE'
      level: string
      expiresAt: string
      status: InviteStatus
      roomCode?: string
    }
  | { type: 'TASK_COMPLETED'; taskCode: string; taskDate: string }
  | { type: 'CHAMPIONSHIP_UPDATE'; championshipId: string; status: string }
  | { type: 'FEEDBACK_REPLY'; ticketId: string }
  | { type: 'ANNOUNCEMENT'; announcementId: string; severity: 'INFO' | 'WARNING' }
  | { type: 'WELCOME' }
  | { type: 'ACCOUNT'; reason: string }

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body?: string
  createdAt: string // ISO 8601
  isRead: boolean
  payload: NotificationPayload
}

export interface NotificationService {
  list(params: {
    cursor?: string
    limit: number
    unreadOnly?: boolean
    types?: NotificationType[]
  }): Promise<{ items: AppNotification[]; nextCursor?: string }>
  unreadCount(): Promise<number>
  markRead(id: string): Promise<void>
  markAllRead(): Promise<void>
}

export interface InviteService {
  respond(inviteId: string, accept: boolean): Promise<{ roomCode?: string }>
}

export interface RealtimeHandlers {
  onInviteReceived(n: AppNotification): void
  onInviteChanged(inviteId: string, status: InviteStatus, roomCode?: string): void
}

export interface NotificationRealtime {
  subscribe(handlers: RealtimeHandlers): () => void
}

export type NotificationFilterCategory = 'all' | 'unread' | 'learn' | 'elo' | 'invite' | 'system'

