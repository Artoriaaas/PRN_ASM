import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type {
  AppNotification,
  NotificationFilterCategory,
  NotificationType,
} from '../services/types'
import { getNotificationService } from '../services/notificationService'
import { useNotifications } from '../useNotifications'
import { NotificationItem } from '../components/NotificationItem'
import { EmptyState } from '../components/EmptyState'
import { DevNotificationControls } from '../components/DevNotificationControls'
import { CATEGORY_TYPES_MAP } from '../utils/notificationMeta'
import { getDateGroupLabel, type DateGroupLabel } from '../utils/relativeTime'

interface FilterChipOption {
  key: NotificationFilterCategory
  label: string
}

const FILTER_OPTIONS: FilterChipOption[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unread', label: 'Chưa đọc' },
  { key: 'learn', label: 'Học tập' },
  { key: 'elo', label: 'Elo & Hạng' },
  { key: 'invite', label: 'Lời mời' },
  { key: 'system', label: 'Hệ thống' },
]

export function NoticesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { unreadCount, markAllAsRead, isSoundEnabled, toggleSound } = useNotifications()
  const notifService = getNotificationService()

  // Đồng bộ filter với query string ?filter=...
  const activeFilter = (searchParams.get('filter') as NotificationFilterCategory) || 'all'

  const [items, setItems] = useState<AppNotification[]>([])
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Map lưu ID thông báo nào đang được mở rộng nội dung (dành cho ANNOUNCEMENT)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  const sentinelRef = useRef<HTMLDivElement>(null)

  const handleFilterChange = (filter: NotificationFilterCategory) => {
    setSearchParams(filter === 'all' ? {} : { filter })
  }

  // Tải trang đầu tiên khi bộ lọc thay đổi
  const fetchFirstPage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const types: NotificationType[] | undefined = CATEGORY_TYPES_MAP[activeFilter]
      const unreadOnly = activeFilter === 'unread'

      const res = await notifService.list({
        limit: 20,
        unreadOnly,
        types,
      })

      setItems(res.items)
      setNextCursor(res.nextCursor)

      // Khi người dùng vào trang xem Tất cả thông báo, tự động đánh dấu đã xem để chuông không còn hiện số
      if (activeFilter === 'all' && unreadCount > 0) {
        void markAllAsRead()
        setItems(res.items.map((item) => ({ ...item, isRead: true })))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách thông báo')
    } finally {
      setLoading(false)
    }
  }, [activeFilter, notifService, unreadCount, markAllAsRead])

  useEffect(() => {
    void fetchFirstPage()
  }, [fetchFirstPage])

  // Tải thêm trang tiếp theo (Infinite Scroll)
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || loading) return
    setLoadingMore(true)
    try {
      const types: NotificationType[] | undefined = CATEGORY_TYPES_MAP[activeFilter]
      const unreadOnly = activeFilter === 'unread'

      const res = await notifService.list({
        cursor: nextCursor,
        limit: 20,
        unreadOnly,
        types,
      })

      setItems((prev) => {
        // Chống trùng ID
        const existingIds = new Set(prev.map((i) => i.id))
        const newOnes = res.items.filter((i) => !existingIds.has(i.id))
        return [...prev, ...newOnes]
      })
      setNextCursor(res.nextCursor)
    } catch (err) {
      console.error('Lỗi khi tải thêm thông báo:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [nextCursor, loadingMore, loading, activeFilter, notifService])

  // IntersectionObserver cho cuộn vô hạn
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && nextCursor && !loadingMore && !loading) {
          void loadMore()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore, nextCursor, loadingMore, loading])

  // Toggle mở rộng thông báo
  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleItemMarkRead = (id: string) => {
    if (activeFilter === 'unread') {
      // Khi đang ở bộ lọc "Chưa đọc", sau khi người dùng bấm xem xong, thông báo lập tức được loại khỏi mục chưa xem
      setItems((prev) => prev.filter((item) => item.id !== id))
    } else {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)))
    }
  }

  const handleMarkAll = async () => {
    await markAllAsRead()
    if (activeFilter === 'unread') {
      setItems([])
    } else {
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })))
    }
  }

  // Phân nhóm theo ngày ("Hôm nay", "Hôm qua", "Tuần này", "Cũ hơn")
  const groupedItems = useMemo(() => {
    const groups: Record<DateGroupLabel, AppNotification[]> = {
      'Hôm nay': [],
      'Hôm qua': [],
      'Tuần này': [],
      'Cũ hơn': [],
    }

    for (const item of items) {
      const label = getDateGroupLabel(item.createdAt)
      groups[label].push(item)
    }

    return groups
  }, [items])

  const dateLabels: DateGroupLabel[] = ['Hôm nay', 'Hôm qua', 'Tuần này', 'Cũ hơn']

  return (
    <div className="notices-page-wrapper">
      {/* Tiêu đề & Thao tác */}
      <div className="notices-header">
        <div className="notices-title-group">
          <h1>Thông báo</h1>
          <p className="notices-subtitle">
            Cập nhật diễn biến trận đấu, điểm số Elo, bài học và tin tức hệ thống
          </p>
        </div>

        <div className="notices-actions">
          {/* Nút bật/tắt âm báo lời mời */}
          <label className="notif-sound-toggle" title="Bật hoặc tắt âm thanh khi có lời mời thách đấu mới">
            <span
              className={`notif-switch-track ${isSoundEnabled ? 'active' : ''}`}
              onClick={toggleSound}
              role="switch"
              aria-checked={isSoundEnabled}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  toggleSound()
                }
              }}
            >
              <span className="notif-switch-thumb" />
            </span>
            <span>Âm báo lời mời</span>
          </label>

          <button
            type="button"
            className="notif-mark-all-btn"
            style={{ padding: '8px 14px', border: '1px solid var(--border)' }}
            disabled={unreadCount === 0}
            onClick={() => void handleMarkAll()}
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      </div>

      {/* DEV controls (chỉ hiện khi DEV) */}
      <div style={{ marginBottom: '16px' }}>
        <DevNotificationControls />
      </div>

      {/* Bộ lọc Chips */}
      <div className="notices-filter-bar" role="tablist" aria-label="Bộ lọc loại thông báo">
        {FILTER_OPTIONS.map((opt) => {
          const isActive = activeFilter === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`notices-filter-chip ${isActive ? 'active' : ''}`}
              onClick={() => handleFilterChange(opt.key)}
            >
              <span>{opt.label}</span>
              {opt.key === 'unread' && unreadCount > 0 && (
                <span className="notices-filter-count">{unreadCount}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Danh sách thông báo */}
      {loading && items.length === 0 ? (
        <div className="notif-skeleton-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="notif-skeleton-item">
              <div className="notif-skeleton-icon" />
              <div className="notif-skeleton-content">
                <div className="notif-skeleton-line short" />
                <div className="notif-skeleton-line full" />
              </div>
            </div>
          ))}
        </div>
      ) : error && items.length === 0 ? (
        <div className="notif-error-state">
          <p className="notif-error-msg">{error}</p>
          <button
            type="button"
            className="notif-retry-btn"
            onClick={() => void fetchFirstPage()}
          >
            Thử lại
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={
            activeFilter === 'unread'
              ? 'Không có thông báo chưa đọc'
              : 'Không có thông báo phù hợp'
          }
          description="Hãy thử đổi bộ lọc hoặc quay lại sau để xem thêm các cập nhật mới."
        />
      ) : (
        <div className="notices-list-container">
          {dateLabels.map((dateLabel) => {
            const groupList = groupedItems[dateLabel]
            if (groupList.length === 0) return null

            return (
              <section key={dateLabel} className="notices-group">
                <h3 className="notices-group-title">{dateLabel}</h3>
                <div className="notices-card-list">
                  {groupList.map((item) => (
                    <NotificationItem
                      key={item.id}
                      notification={item}
                      isPopover={false}
                      isExpanded={Boolean(expandedIds[item.id])}
                      onToggleExpand={() => handleToggleExpand(item.id)}
                      onMarkRead={handleItemMarkRead}
                    />
                  ))}
                </div>
              </section>
            )
          })}

          {/* Sentinel cho cuộn vô hạn */}
          <div ref={sentinelRef} className="notices-infinite-sentinel">
            {loadingMore && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Đang tải thêm thông báo…
              </p>
            )}
            {!loadingMore && nextCursor && (
              <button
                type="button"
                className="notices-load-more-btn"
                onClick={() => void loadMore()}
              >
                Tải thêm thông báo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

