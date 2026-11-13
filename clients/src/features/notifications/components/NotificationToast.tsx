import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../useNotifications'

export function NotificationToast() {
  const { latestInviteToast, dismissToast } = useNotifications()
  const navigate = useNavigate()

  if (!latestInviteToast) return null
  const payload = latestInviteToast.payload
  if (payload.type !== 'MATCH_INVITE') return null

  const handleView = () => {
    dismissToast()
    navigate('/notices?filter=invite')
  }

  return (
    <div className="notif-toast-container" aria-live="assertive">
      <div className="notif-toast">
        <span className="notif-toast-icon" aria-hidden="true">
          ⚔️
        </span>

        <div className="notif-toast-text">
          <h4 className="notif-toast-title">{payload.fromName} mời bạn đấu!</h4>
          <p className="notif-toast-desc">
            {payload.variant === 'SHUFFLE' ? 'Xáo trộn' : 'Cổ điển'} – {payload.level}
          </p>
        </div>

        <button
          type="button"
          className="notif-toast-view-btn"
          onClick={handleView}
          aria-label="Xem chi tiết lời mời đấu"
        >
          Xem
        </button>

        <button
          type="button"
          className="notif-toast-close-btn"
          onClick={dismissToast}
          aria-label="Đóng thông báo lời mời"
        >
          ×
        </button>
      </div>
    </div>
  )
}

