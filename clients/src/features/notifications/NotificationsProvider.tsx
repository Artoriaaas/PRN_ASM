import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useAuth } from '../../auth/useAuth'
import type { AppNotification, InviteStatus } from './services/types'
import { getNotificationService, MockNotificationService } from './services/notificationService'
import { getInviteService } from './services/inviteService'
import { getNotificationRealtime, getMockRealtime } from './services/realtime'
import { NotificationsContext, type NotificationsContextValue } from './useNotifications'
import './notifications.css'

const SOUND_PREF_KEY = 'sudoku.notif.sound'

function playInviteChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()

    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now) // D5
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(880, now + 0.12) // A5

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.start(now)
    osc1.stop(now + 0.12)
    osc2.start(now + 0.12)
    osc2.stop(now + 0.45)
  } catch {
    // Ignore audio errors
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const notifService = getNotificationService()
  const inviteService = getInviteService()
  const realtime = getNotificationRealtime()

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [latestInviteToast, setLatestInviteToast] = useState<AppNotification | null>(null)
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SOUND_PREF_KEY) === 'true'
    } catch {
      return false
    }
  })

  const [nowTime, setNowTime] = useState<number>(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now())
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  const prevUnreadRef = useRef<number>(0)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toggleSound = useCallback(() => {
    setIsSoundEnabled((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SOUND_PREF_KEY, String(next))
      } catch {
        // Ignore storage error
      }
      return next
    })
  }, [])

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setLatestInviteToast(null)
  }, [])

  // Nạp 10 thông báo mới nhất cho popover
  const fetchRecent = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const res = await notifService.list({ limit: 10 })
      setNotifications(res.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải thông báo')
    } finally {
      setLoading(false)
    }
  }, [user, notifService])

  // Lấy số lượng chưa đọc
  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    try {
      const count = await notifService.unreadCount()
      setUnreadCount((prev) => {
        // Nếu số chưa đọc tăng lên, tự động cập nhật danh sách đầu trang
        if (count > prev) {
          void fetchRecent()
        }
        prevUnreadRef.current = count
        return count
      })
    } catch {
      // Bỏ qua lỗi polling nền
    }
  }, [user, notifService, fetchRecent])

  // Reset khi đăng xuất
  useEffect(() => {
    if (!user) {
      setNotifications([])
      setUnreadCount(0)
      setError(null)
      setLatestInviteToast(null)
    } else {
      void refreshUnreadCount()
      void fetchRecent()
    }
  }, [user, refreshUnreadCount, fetchRecent])

  // Polling mỗi 30s khi tab hiển thị + gọi ngay khi tab lấy lại focus
  useEffect(() => {
    if (!user) return

    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshUnreadCount()
      }
    }

    window.addEventListener('focus', handleFocusOrVisible)
    document.addEventListener('visibilitychange', handleFocusOrVisible)

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshUnreadCount()
      }
    }, 30000)

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible)
      document.removeEventListener('visibilitychange', handleFocusOrVisible)
      clearInterval(interval)
    }
  }, [user, refreshUnreadCount])

  // Đăng ký nhận sự kiện realtime (lời mời đấu)
  useEffect(() => {
    if (!user) return

    const unsubscribe = realtime.subscribe({
      onInviteReceived: (item: AppNotification) => {
        setNotifications((prev) => {
          // Chống trùng ID
          if (prev.some((n) => n.id === item.id)) return prev
          return [item, ...prev]
        })
        setUnreadCount((cnt) => cnt + 1)

        // Nếu tab đang hiển thị thì hiện toast và phát âm nếu bật
        if (document.visibilityState === 'visible') {
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
          setLatestInviteToast(item)
          if (isSoundEnabled) {
            playInviteChime()
          }
          toastTimeoutRef.current = setTimeout(() => {
            setLatestInviteToast(null)
          }, 6000)
        }
      },
      onInviteChanged: (inviteId: string, status: InviteStatus, roomCode?: string) => {
        setNotifications((prev) =>
          prev.map((n) => {
            if (n.payload.type === 'MATCH_INVITE' && n.payload.inviteId === inviteId) {
              return {
                ...n,
                payload: {
                  ...n.payload,
                  status,
                  roomCode: roomCode ?? n.payload.roomCode,
                },
              }
            }
            return n
          }),
        )
      },
    })

    return () => {
      unsubscribe()
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [user, realtime, isSoundEnabled])

  // Nhận thông báo phát từ các tính năng trong ứng dụng (khi hoàn thành ván, bài học, thăng cấp...)
  useEffect(() => {
    const handleNewNotification = (e: Event) => {
      const customEvent = e as CustomEvent<AppNotification>
      const item = customEvent.detail
      if (!item) return

      setNotifications((prev) => {
        if (prev.some((n) => n.id === item.id)) return prev
        return [item, ...prev]
      })
      setUnreadCount((c) => c + 1)

      if (document.visibilityState === 'visible') {
        if (item.type === 'MATCH_INVITE') {
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
          setLatestInviteToast(item)
          if (isSoundEnabled) {
            playInviteChime()
          }
          toastTimeoutRef.current = setTimeout(() => {
            setLatestInviteToast(null)
          }, 6000)
        }
      }
    }

    window.addEventListener('sudoku:new-notification', handleNewNotification)
    return () => window.removeEventListener('sudoku:new-notification', handleNewNotification)
  }, [isSoundEnabled])

  // Đánh dấu đã đọc lạc quan (optimistic)
  const markAsRead = useCallback(
    async (id: string) => {
      // 1. Cập nhật UI ngay lập tức
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))

      // 2. Ghi nhận vào service và đồng bộ lại số chưa đọc chuẩn xác
      try {
        await notifService.markRead(id)
        const accurateCount = await notifService.unreadCount()
        setUnreadCount(accurateCount)
      } catch {
        setError('Không thể cập nhật trạng thái đã đọc')
      }
    },
    [notifService],
  )

  // Đánh dấu tất cả đã đọc
  const markAllAsRead = useCallback(async () => {
    // 1. Cập nhật UI ngay lập tức: số chưa đọc về 0, tất cả thông báo thành isRead: true
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)

    // 2. Ghi nhận vào service và đồng bộ lại số chưa đọc
    try {
      await notifService.markAllRead()
      const accurateCount = await notifService.unreadCount()
      setUnreadCount(accurateCount)
    } catch {
      setError('Không thể đánh dấu tất cả đã đọc')
    }
  }, [notifService])

  // Phản hồi lời mời đấu
  const respondToInvite = useCallback(
    async (inviteId: string, accept: boolean): Promise<{ roomCode?: string }> => {
      const res = await inviteService.respond(inviteId, accept)
      const newStatus: InviteStatus = accept ? 'ACCEPTED' : 'DECLINED'

      setNotifications((prev) =>
        prev.map((n) => {
          if (n.payload.type === 'MATCH_INVITE' && n.payload.inviteId === inviteId) {
            return {
              ...n,
              isRead: true,
              payload: {
                ...n.payload,
                status: newStatus,
                roomCode: res.roomCode ?? n.payload.roomCode,
              },
            }
          }
          return n
        }),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
      return res
    },
    [inviteService],
  )

  // Kiểm tra có lời mời nào đang PENDING và chưa hết hạn không
  const hasPendingInvite = notifications.some((n) => {
    if (n.payload.type !== 'MATCH_INVITE') return false
    if (n.payload.status !== 'PENDING') return false
    return new Date(n.payload.expiresAt).getTime() > nowTime
  })

  // Dev Helpers để giả lập thông báo
  const simulateInvite = useCallback(() => {
    const inviteId = `inv-${Date.now()}`
    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      type: 'MATCH_INVITE',
      title: 'Minh Anh mời bạn đấu Shuffle – Khó',
      body: 'Ván đấu 1v1 ngẫu nhiên tính điểm xếp hạng.',
      createdAt: new Date().toISOString(),
      isRead: false,
      payload: {
        type: 'MATCH_INVITE',
        inviteId,
        fromUserId: 'usr-minhanh',
        fromName: 'Minh Anh',
        variant: 'SHUFFLE',
        level: 'Khó',
        expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
        status: 'PENDING',
      },
    }

    if (notifService instanceof MockNotificationService) {
      notifService.addNotification(notif)
    }
    getMockRealtime().emitInvite(notif)
  }, [notifService])

  const simulateEloGain = useCallback(() => {
    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      type: 'ELO_CHANGED',
      title: 'Elo +22 (1 260 → 1 282)',
      body: 'Chiến thắng thuyết phục trong ván đấu tay đôi tính giờ.',
      createdAt: new Date().toISOString(),
      isRead: false,
      payload: {
        type: 'ELO_CHANGED',
        delta: 22,
        oldElo: 1260,
        newElo: 1282,
        source: 'MULTI',
        sourceId: `match-${Date.now()}`,
      },
    }

    if (notifService instanceof MockNotificationService) {
      notifService.addNotification(notif)
    }
    setNotifications((prev) => [notif, ...prev])
    setUnreadCount((c) => c + 1)
  }, [notifService])

  const simulateLessonComplete = useCallback(() => {
    const notif: AppNotification = {
      id: `notif-${Date.now()}`,
      type: 'LESSON_COMPLETED',
      title: 'Bạn đã hoàn thành bài 4/7: Cặp ô trần (Naked Pair)',
      body: 'Kỹ thuật nhận biết 2 ô trong cùng hàng/khối chứa cùng cặp ứng viên duy nhất.',
      createdAt: new Date().toISOString(),
      isRead: false,
      payload: {
        type: 'LESSON_COMPLETED',
        lessonCode: 'naked-pair',
        order: 4,
        total: 7,
        nextLessonCode: 'hidden-pair',
      },
    }

    if (notifService instanceof MockNotificationService) {
      notifService.addNotification(notif)
    }
    setNotifications((prev) => [notif, ...prev])
    setUnreadCount((c) => c + 1)
  }, [notifService])

  const simulateTenNotifications = useCallback(() => {
    const newItems: AppNotification[] = Array.from({ length: 11 }, (_, i) => ({
      id: `notif-bulk-${Date.now()}-${i}`,
      type: 'ELO_CHANGED' as const,
      title: `Thông báo thử nghiệm #${i + 1}`,
      body: `Đây là thông báo mẫu để kiểm tra hiển thị huy hiệu 9+ trên chuông.`,
      createdAt: new Date().toISOString(),
      isRead: false,
      payload: {
        type: 'ELO_CHANGED' as const,
        delta: 10 + i,
        oldElo: 1200,
        newElo: 1210 + i,
        source: 'MULTI' as const,
        sourceId: `bulk-${i}`,
      },
    }))

    if (notifService instanceof MockNotificationService) {
      for (const item of newItems) {
        notifService.addNotification(item)
      }
    }
    setNotifications((prev) => [...newItems, ...prev])
    setUnreadCount((c) => c + newItems.length)
  }, [notifService])

  const clearAllNotifications = useCallback(() => {
    const empty: AppNotification[] = []
    try {
      localStorage.setItem('sudoku.notifications.mock.v2', JSON.stringify(empty))
      localStorage.removeItem('sudoku.notifications.mock.v1')
    } catch {
      // Ignore storage error
    }
    setNotifications([])
    setUnreadCount(0)
    setLatestInviteToast(null)
  }, [])

  const value: NotificationsContextValue = {
    notifications,
    unreadCount,
    loading,
    error,
    hasPendingInvite,
    latestInviteToast,
    isSoundEnabled,
    toggleSound,
    refreshUnreadCount,
    fetchRecent,
    markAsRead,
    markAllAsRead,
    respondToInvite,
    dismissToast,
    simulateInvite,
    simulateEloGain,
    simulateLessonComplete,
    simulateTenNotifications,
    clearAllNotifications,
  }

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
