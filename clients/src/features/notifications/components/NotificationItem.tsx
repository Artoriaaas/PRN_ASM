import { type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppNotification } from '../services/types'
import { useNotifications } from '../useNotifications'
import { getNotificationMeta } from '../utils/notificationMeta'
import { formatRelativeTimeVi } from '../utils/relativeTime'
import { InviteCard } from './InviteCard'

interface NotificationItemProps {
  notification: AppNotification
  isPopover?: boolean
  onClosePopover?: () => void
  isExpanded?: boolean
  onToggleExpand?: () => void
  onMarkRead?: (id: string) => void
}

export function NotificationItem({
  notification,
  isPopover = false,
  onClosePopover,
  isExpanded = false,
  onToggleExpand,
  onMarkRead,
}: NotificationItemProps) {
  const navigate = useNavigate()
  const { markAsRead } = useNotifications()

  // Đối với loại lời mời thách đấu, hiển thị thẻ tương tác chuyên biệt
  if (notification.type === 'MATCH_INVITE') {
    return (
      <div style={{ padding: isPopover ? '6px 12px' : '0' }}>
        <InviteCard
          notification={notification}
          onActionComplete={onClosePopover}
          onMarkRead={onMarkRead}
        />
      </div>
    )
  }

  const meta = getNotificationMeta(notification)
  const isUnread = !notification.isRead

  const handleClick = async () => {
    if (isUnread) {
      onMarkRead?.(notification.id)
      await markAsRead(notification.id)
    }

    if (meta.targetRoute) {
      navigate(meta.targetRoute)
      onClosePopover?.()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  // Hiển thị huy hiệu Elo trực quan
  const renderEloBadge = () => {
    if (notification.type !== 'ELO_CHANGED' || notification.payload.type !== 'ELO_CHANGED') {
      return null
    }
    const delta = notification.payload.delta
    if (delta > 0) {
      return <span className="notif-elo-badge gain">▲ +{delta}</span>
    }
    if (delta < 0) {
      return <span className="notif-elo-badge loss">▼ −{Math.abs(delta)}</span>
    }
    return <span className="notif-elo-badge neutral">— ±0</span>
  }

  const isWarningAnnouncement =
    notification.type === 'ANNOUNCEMENT' &&
    notification.payload.type === 'ANNOUNCEMENT' &&
    notification.payload.severity === 'WARNING'

  return (
    <div
      role="button"
      tabIndex={0}
      className={`notif-item ${isUnread ? 'is-unread' : ''} ${
        isWarningAnnouncement ? 'is-warning' : ''
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${notification.title}. ${notification.body ?? ''}. ${
        isUnread ? 'Chưa đọc.' : 'Đã đọc.'
      }`}
    >
      <div
        className="notif-icon-box"
        style={{ background: meta.bgSoft, color: meta.color }}
        aria-hidden="true"
      >
        {meta.icon}
      </div>

      <div className="notif-item-content">
        <div className="notif-item-header">
          <h4 className="notif-item-title">{notification.title}</h4>
          {isUnread && <span className="notif-unread-dot" title="Chưa đọc" aria-hidden="true" />}
        </div>

        {renderEloBadge() && <div style={{ marginBottom: '4px' }}>{renderEloBadge()}</div>}

        {notification.body && (
          <p
            className="notif-item-body"
            style={
              !isPopover && isExpanded
                ? { display: 'block', WebkitLineClamp: 'unset' }
                : undefined
            }
          >
            {notification.body}
          </p>
        )}

        {/* Nút Xem thêm cho thông báo dài trên trang /notices */}
        {!isPopover &&
          notification.type === 'ANNOUNCEMENT' &&
          notification.body &&
          notification.body.length > 80 && (
            <button
              type="button"
              className="notices-expand-btn"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand?.()
              }}
            >
              {isExpanded ? 'Thu gọn ▲' : 'Xem đầy đủ ▼'}
            </button>
          )}

        <span className="notif-item-time">{formatRelativeTimeVi(notification.createdAt)}</span>
      </div>
    </div>
  )
}

