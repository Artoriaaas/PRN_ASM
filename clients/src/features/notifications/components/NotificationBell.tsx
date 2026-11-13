import { useState, useRef, useCallback } from 'react'
import { useNotifications } from '../useNotifications'
import { NotificationPopover } from './NotificationPopover'

export function NotificationBell() {
  const { unreadCount, hasPendingInvite } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const bellButtonRef = useRef<HTMLButtonElement>(null)

  const togglePopover = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const closePopover = useCallback(() => {
    setIsOpen(false)
  }, [])

  const badgeText = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : null

  const ariaLabel =
    unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'

  return (
    <div className="notif-popover-anchor">
      <button
        ref={bellButtonRef}
        type="button"
        className={`notif-bell-btn ${hasPendingInvite ? 'notif-bell-shake' : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={togglePopover}
      >
        <span className="notif-bell-icon" aria-hidden="true">
          🔔
        </span>

        {badgeText && (
          <span
            className={`notif-badge ${hasPendingInvite ? 'badge-invite' : ''}`}
            aria-hidden="true"
          >
            {badgeText}
          </span>
        )}
      </button>

      <NotificationPopover
        isOpen={isOpen}
        onClose={closePopover}
        anchorRef={bellButtonRef}
      />
    </div>
  )
}

