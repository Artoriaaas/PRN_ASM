import type { AppNotification, NotificationFilterCategory, NotificationType } from '../services/types'

export interface NotificationMetaConfig {
  icon: string
  color: string
  bgSoft: string
  category: NotificationFilterCategory
  categoryLabel: string
  targetRoute?: string
}

export function getNotificationMeta(notification: AppNotification): NotificationMetaConfig {
  const { type, payload } = notification

  switch (type) {
    case 'LESSON_COMPLETED': {
      const p = payload.type === 'LESSON_COMPLETED' ? payload : undefined
      const nextCode = p?.nextLessonCode
      return {
        icon: '🎓',
        color: '#15803D',
        bgSoft: 'rgba(21, 128, 61, 0.12)',
        category: 'learn',
        categoryLabel: 'Học tập',
        targetRoute: nextCode ? `/learn/${nextCode}` : '/learn',
      }
    }
    case 'COURSE_COMPLETED':
      return {
        icon: '🏆',
        color: '#D97706',
        bgSoft: 'rgba(217, 119, 6, 0.12)',
        category: 'learn',
        categoryLabel: 'Học tập',
        targetRoute: '/solo/new',
      }
    case 'TASK_COMPLETED':
      return {
        icon: '✅',
        color: '#16A34A',
        bgSoft: 'rgba(22, 163, 74, 0.12)',
        category: 'learn',
        categoryLabel: 'Học tập',
        targetRoute: '/quests',
      }
    case 'ELO_CHANGED': {
      const p = payload.type === 'ELO_CHANGED' ? payload : undefined
      const delta = p?.delta ?? 0
      if (delta > 0) {
        return {
          icon: '▲',
          color: '#15803D',
          bgSoft: 'rgba(21, 128, 61, 0.14)',
          category: 'elo',
          categoryLabel: 'Elo & Hạng',
          targetRoute: '/leaderboard',
        }
      } else if (delta < 0) {
        return {
          icon: '▼',
          color: '#DC2626',
          bgSoft: 'rgba(220, 38, 38, 0.12)',
          category: 'elo',
          categoryLabel: 'Elo & Hạng',
          targetRoute: '/leaderboard',
        }
      }
      return {
        icon: '—',
        color: '#64748B',
        bgSoft: 'rgba(100, 116, 139, 0.12)',
        category: 'elo',
        categoryLabel: 'Elo & Hạng',
        targetRoute: '/leaderboard',
      }
    }
    case 'TIER_CHANGED': {
      const p = payload.type === 'TIER_CHANGED' ? payload : undefined
      const isUp = p?.direction === 'UP'
      return {
        icon: isUp ? '⭐' : '🛡️',
        color: isUp ? '#EAB308' : '#EA580C',
        bgSoft: isUp ? 'rgba(234, 179, 8, 0.16)' : 'rgba(234, 88, 12, 0.12)',
        category: 'elo',
        categoryLabel: 'Elo & Hạng',
        targetRoute: '/leaderboard',
      }
    }
    case 'MATCH_INVITE': {
      return {
        icon: '⚔️',
        color: '#0284C7',
        bgSoft: 'rgba(2, 132, 199, 0.12)',
        category: 'invite',
        categoryLabel: 'Lời mời',
        targetRoute: undefined, // Xử lý bằng nút bấm trên thẻ lời mời
      }
    }
    case 'CHAMPIONSHIP_UPDATE':
      return {
        icon: '🎖️',
        color: '#7C3AED',
        bgSoft: 'rgba(124, 58, 237, 0.12)',
        category: 'system',
        categoryLabel: 'Giải đấu',
        targetRoute: undefined,
      }
    case 'FEEDBACK_REPLY':
      return {
        icon: '💬',
        color: '#0284C7',
        bgSoft: 'rgba(2, 132, 199, 0.12)',
        category: 'system',
        categoryLabel: 'Hỗ trợ',
        targetRoute: '/settings',
      }
    case 'ANNOUNCEMENT': {
      const p = payload.type === 'ANNOUNCEMENT' ? payload : undefined
      const isWarning = p?.severity === 'WARNING'
      return {
        icon: isWarning ? '⚠️' : '📢',
        color: isWarning ? '#D97706' : '#475569',
        bgSoft: isWarning ? 'rgba(217, 119, 6, 0.12)' : 'rgba(71, 85, 105, 0.12)',
        category: 'system',
        categoryLabel: 'Thông báo',
        targetRoute: `/notices?id=${p?.announcementId ?? ''}`,
      }
    }
    case 'WELCOME':
      return {
        icon: '👋',
        color: '#15803D',
        bgSoft: 'rgba(21, 128, 61, 0.12)',
        category: 'system',
        categoryLabel: 'Chào mừng',
        targetRoute: '/learn',
      }
    case 'ACCOUNT':
      return {
        icon: '🚨',
        color: '#DC2626',
        bgSoft: 'rgba(220, 38, 38, 0.12)',
        category: 'system',
        categoryLabel: 'Tài khoản',
        targetRoute: '/profile',
      }
    default:
      return {
        icon: '🔔',
        color: '#4B6354',
        bgSoft: 'rgba(75, 99, 84, 0.1)',
        category: 'system',
        categoryLabel: 'Hệ thống',
        targetRoute: '/notices',
      }
  }
}

export const CATEGORY_TYPES_MAP: Record<NotificationFilterCategory, NotificationType[] | undefined> = {
  all: undefined,
  unread: undefined,
  learn: ['LESSON_COMPLETED', 'COURSE_COMPLETED', 'TASK_COMPLETED'],
  elo: ['ELO_CHANGED', 'TIER_CHANGED'],
  invite: ['MATCH_INVITE'],
  system: ['ANNOUNCEMENT', 'ACCOUNT', 'FEEDBACK_REPLY', 'WELCOME', 'CHAMPIONSHIP_UPDATE'],
}

