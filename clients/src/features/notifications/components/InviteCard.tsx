import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { AppNotification } from '../services/types'
import { useNotifications } from '../useNotifications'
import { formatCountdown } from '../utils/relativeTime'

interface InviteCardProps {
  notification: AppNotification
  onActionComplete?: () => void
  onMarkRead?: (id: string) => void
}

export function InviteCard({ notification, onActionComplete, onMarkRead }: InviteCardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { respondToInvite, markAsRead } = useNotifications()

  const [responding, setResponding] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [localExpired, setLocalExpired] = useState(false)

  const payload = notification.payload.type === 'MATCH_INVITE' ? notification.payload : null

  // Đếm ngược thời gian còn lại
  const expiresAtMs = payload ? new Date(payload.expiresAt).getTime() : 0
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)),
  )

  useEffect(() => {
    if (!payload || payload.status !== 'PENDING') return

    const updateTimer = () => {
      const left = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
      setRemainingSec(left)
      if (left === 0) {
        setLocalExpired(true)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [expiresAtMs, payload])

  // Kiểm tra người chơi có đang trong trận không
  const inGame =
    (location.pathname.startsWith('/solo/') || location.pathname.startsWith('/match/')) &&
    !location.pathname.endsWith('/new') &&
    !location.pathname.endsWith('/result')

  const isExpired = Boolean(
    payload?.status === 'EXPIRED' || remainingSec <= 0 || localExpired,
  )
  const isPending = Boolean(payload?.status === 'PENDING' && !isExpired)

  const handleResponse = useCallback(
    async (accept: boolean) => {
      if (!payload || responding || !isPending) return
      setResponding(true)
      setErrorMsg('')
      try {
        const res = await respondToInvite(payload.inviteId, accept)
        onMarkRead?.(notification.id)
        onActionComplete?.()

        if (accept && res.roomCode) {
          navigate(`/match/${res.roomCode}`)
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Có lỗi xảy ra khi xử lý lời mời')
      } finally {
        setResponding(false)
      }
    },
    [payload, responding, isPending, respondToInvite, onMarkRead, notification.id, onActionComplete, navigate],
  )

  const handleCardClick = useCallback(async () => {
    if (!notification.isRead) {
      onMarkRead?.(notification.id)
      await markAsRead(notification.id)
    }
  }, [notification.isRead, notification.id, onMarkRead, markAsRead])

  if (!payload) return null

  const variantLabel = payload.variant === 'SHUFFLE' ? 'Xáo trộn' : 'Cổ điển'
  const initials = payload.fromName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div
      className={`notif-invite-card ${
        isExpired
          ? 'expired'
          : payload.status === 'ACCEPTED'
          ? 'accepted'
          : payload.status === 'DECLINED'
          ? 'declined'
          : payload.status === 'CANCELLED'
          ? 'cancelled'
          : ''
      } ${!notification.isRead ? 'is-unread' : ''}`}
      onClick={!isPending && !notification.isRead ? () => void handleCardClick() : undefined}
      style={!isPending && !notification.isRead ? { cursor: 'pointer' } : undefined}
    >
      <div className="notif-invite-header">
        <div className="notif-invite-avatar" aria-hidden="true">
          {payload.fromAvatarUrl ? (
            <img src={payload.fromAvatarUrl} alt="" />
          ) : (
            <span>{initials || 'U'}</span>
          )}
        </div>

        <div className="notif-invite-info">
          <h4 className="notif-invite-name">{payload.fromName}</h4>
          <div className="notif-invite-meta">
            <span className="notif-invite-chip">{variantLabel}</span>
            <span className="notif-invite-chip">{payload.level}</span>
            {isPending && (
              <span className={`notif-invite-timer ${remainingSec <= 15 ? 'warning' : ''}`}>
                ⏱ còn {formatCountdown(remainingSec)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trạng thái lời mời */}
      {isPending ? (
        <>
          <div className="notif-invite-actions">
            <button
              type="button"
              className="notif-btn-accept"
              disabled={responding || inGame}
              onClick={() => void handleResponse(true)}
              aria-label={`Chấp nhận lời mời từ ${payload.fromName}`}
            >
              {responding ? 'Đang xử lý…' : 'Chấp nhận'}
            </button>
            <button
              type="button"
              className="notif-btn-decline"
              disabled={responding}
              onClick={() => void handleResponse(false)}
              aria-label={`Từ chối lời mời từ ${payload.fromName}`}
            >
              Từ chối
            </button>
          </div>
          {inGame && (
            <p className="notif-in-game-hint" role="status">
              ⚠️ Bạn đang trong trận — không thể chấp nhận phòng mới.
            </p>
          )}
        </>
      ) : (
        <div className="notif-invite-status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div>
            {payload.status === 'ACCEPTED' && (
              <span className="notif-invite-status-badge accepted">✓ Đã chấp nhận</span>
            )}
            {payload.status === 'DECLINED' && (
              <span className="notif-invite-status-badge declined">✕ Đã từ chối</span>
            )}
            {isExpired && (
              <span className="notif-invite-status-badge expired">⌛ Đã hết hạn</span>
            )}
            {payload.status === 'CANCELLED' && (
              <span className="notif-invite-status-badge cancelled">⊘ Đã hủy</span>
            )}
          </div>

          {!notification.isRead && (
            <button
              type="button"
              className="notif-mark-read-chip"
              onClick={(e) => {
                e.stopPropagation()
                void handleCardClick()
              }}
              style={{
                fontSize: '0.74rem',
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
              title="Đánh dấu thông báo này là đã đọc"
            >
              Đã xem ✓
            </button>
          )}
        </div>
      )}

      {errorMsg && <p className="notif-error-msg" style={{ marginTop: '6px' }}>{errorMsg}</p>}
    </div>
  )
}
