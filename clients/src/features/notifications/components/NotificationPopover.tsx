import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../useNotifications'
import { NotificationItem } from './NotificationItem'
import { EmptyState } from './EmptyState'
import { DevNotificationControls } from './DevNotificationControls'

interface NotificationPopoverProps {
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}

export function NotificationPopover({ isOpen, onClose, anchorRef }: NotificationPopoverProps) {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    fetchRecent,
  } = useNotifications()

  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const popoverRef = useRef<HTMLDivElement>(null)

  // Đóng popover khi nhấn phím Esc và trả focus về nút chuông
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        anchorRef.current?.focus()
      }
    }

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen, onClose, anchorRef])

  const handleMarkAll = useCallback(async () => {
    await markAllAsRead()
  }, [markAllAsRead])

  if (!isOpen) return null

  // Tối đa 10 mục gần nhất
  const top10 = notifications.slice(0, 10)
  const displayItems = activeTab === 'unread' ? top10.filter((n) => !n.isRead) : top10

  const unreadItems = displayItems.filter((n) => !n.isRead)
  const readItems = displayItems.filter((n) => n.isRead)

  return (
    <div
      ref={popoverRef}
      className="notif-popover-dropdown"
      role="dialog"
      aria-modal="true"
      aria-label="Cửa sổ thông báo"
    >
      {/* Header */}
      <div className="notif-popover-header">
        <div className="notif-header-top">
          <h3 className="notif-header-title">Thông báo</h3>
          <button
            type="button"
            className="notif-mark-all-btn"
            disabled={unreadCount === 0}
            onClick={() => void handleMarkAll()}
            title="Đánh dấu tất cả thông báo là đã đọc"
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>

        {/* Hai tabs */}
        <div className="notif-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            className={`notif-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <span>Tất cả</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'unread'}
            className={`notif-tab-btn ${activeTab === 'unread' ? 'active' : ''}`}
            onClick={() => setActiveTab('unread')}
          >
            <span>Chưa đọc</span>
            {unreadCount > 0 && <span className="notif-tab-count">{unreadCount}</span>}
          </button>
        </div>

        {/* Nút DEV giả lập */}
        <DevNotificationControls />
      </div>

      {/* Body */}
      <div className="notif-popover-body" tabIndex={0} aria-label="Danh sách thông báo gần đây">
        {loading && notifications.length === 0 ? (
          <div className="notif-skeleton-list" aria-label="Đang tải thông báo">
            {[1, 2, 3].map((k) => (
              <div key={k} className="notif-skeleton-item">
                <div className="notif-skeleton-icon" />
                <div className="notif-skeleton-content">
                  <div className="notif-skeleton-line short" />
                  <div className="notif-skeleton-line full" />
                </div>
              </div>
            ))}
          </div>
        ) : error && notifications.length === 0 ? (
          <div className="notif-error-state">
            <p className="notif-error-msg">{error}</p>
            <button
              type="button"
              className="notif-retry-btn"
              onClick={() => void fetchRecent()}
            >
              Thử lại
            </button>
          </div>
        ) : displayItems.length === 0 ? (
          <EmptyState
            title={activeTab === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
            description={
              activeTab === 'unread'
                ? 'Tuyệt vời! Bạn đã đọc hết tất cả các thông báo mới.'
                : 'Hoàn thành một bài học hoặc chơi một ván để nhận thông báo đầu tiên.'
            }
          />
        ) : (
          <>
            {/* Nhóm Mới (Chưa đọc) */}
            {unreadItems.length > 0 && (
              <div className="notif-group-section">
                {activeTab === 'all' && readItems.length > 0 && (
                  <div className="notif-section-label">Mới</div>
                )}
                {unreadItems.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    isPopover={true}
                    onClosePopover={onClose}
                    onMarkRead={markAsRead}
                  />
                ))}
              </div>
            )}

            {/* Nhóm Trước đó (Đã đọc) */}
            {readItems.length > 0 && activeTab === 'all' && (
              <div className="notif-group-section">
                {unreadItems.length > 0 && (
                  <div className="notif-section-label">Trước đó</div>
                )}
                {readItems.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    isPopover={true}
                    onClosePopover={onClose}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="notif-popover-footer">
        <Link
          to="/notices"
          className="notif-view-all-link"
          onClick={onClose}
        >
          Xem tất cả thông báo →
        </Link>
      </div>
    </div>
  )
}
