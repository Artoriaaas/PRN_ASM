import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { clearCachedProfile } from '../../api/userClient'

type ResultState = {
  layout?: string
  level?: string
  startedAt?: number
  mistakes?: number
  hints?: number
  isOffline?: boolean
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function SoloResultPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = (location.state ?? {}) as ResultState
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      clearCachedProfile(user.uid)
    }
  }, [user])

  const [endedAt] = useState(() => Date.now())
  const duration = state.startedAt ? endedAt - state.startedAt : 0
  const accuracy = state.mistakes != null
    ? Math.max(0, Math.round(((81 - state.mistakes) / 81) * 100))
    : 100

  // XP mock (sẽ lấy từ Game.SubmitResult response)
  const xpEarned = Math.max(0, 100 - (state.mistakes ?? 0) * 10)

  return (
    <div className="result-page">
      <div className="result-inner">
        <div className="result-badge">
          <span aria-hidden="true">✓</span>
        </div>

        <p className="eyebrow">KẾT QUẢ</p>
        <h1 className="result-title">Hoàn thành!</h1>

        <div className="result-stats">
          <div className="result-stat">
            <strong className="rs-value">{formatDuration(duration)}</strong>
            <p className="rs-label">Thời gian</p>
          </div>
          <div className="result-stat">
            <strong className="rs-value">{accuracy}%</strong>
            <p className="rs-label">Độ chính xác</p>
          </div>
          <div className="result-stat">
            <strong className="rs-value">{state.mistakes ?? 0}</strong>
            <p className="rs-label">Lỗi</p>
          </div>
          <div className="result-stat">
            <strong className="rs-value">{state.hints ?? 0}</strong>
            <p className="rs-label">Gợi ý dùng</p>
          </div>
        </div>

        <div className="result-xp">
          <span className="xp-gained">+{xpEarned} XP</span>
          <p>Kinh nghiệm nhận được</p>
        </div>
        {state.isOffline && (
          <p className="offline-result-note" style={{ marginTop: 12, fontSize: '0.88rem', color: 'var(--muted)', textAlign: 'center' }}>
            ℹ️ Ván này được chơi ở chế độ Ngoại tuyến (Offline). Để tích lũy số ván thắng và XP vào tài khoản, hãy đảm bảo hệ thống backend đang hoạt động khi bắt đầu ván.
          </p>
        )}

        <div className="result-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => navigate('/solo/new', { state: { layout: state.layout, level: state.level } })}
          >
            Chơi lại cùng độ khó
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-lg"
            onClick={() => navigate('/home')}
          >
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  )
}
