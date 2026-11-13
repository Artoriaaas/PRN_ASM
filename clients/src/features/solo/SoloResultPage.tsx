import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { recordLocalGameResult } from '../../api/userClient'
import { createAndPublishNotification } from '../notifications/services/notificationService'
import type { AppNotification } from '../notifications/services/types'
import { checkQuestCompletion, markQuestComplete, todayStr } from '../quests/questSystem'

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
  const { sessionId } = useParams<{ sessionId: string }>()
  const state = (location.state ?? {}) as ResultState
  const { user } = useAuth()

  const [endedAt] = useState(() => Date.now())
  const duration = state.startedAt ? endedAt - state.startedAt : 0
  const accuracy =
    state.mistakes != null ? Math.max(0, Math.round(((81 - state.mistakes) / 81) * 100)) : 100

  // Điểm kinh nghiệm nhận được
  const xpEarned = Math.max(0, 100 - (state.mistakes ?? 0) * 10)

  const hasRecordedRef = useRef(false)

  // Ghi nhận ván đấu và phát thông báo khi hoàn thành
  useEffect(() => {
    if (!user || hasRecordedRef.current) return
    const recordKey = `solo_rec_${sessionId || 'game'}`
    if (sessionStorage.getItem(recordKey)) return

    sessionStorage.setItem(recordKey, '1')
    hasRecordedRef.current = true

    const { profile: updatedProfile, leveledUp, oldLevel, newLevel } = recordLocalGameResult(
      user.uid,
      xpEarned,
      true,
      user.displayName || user.email?.split('@')[0] || 'Người chơi',
    )

    // Tạo thông báo hoàn thành ván Solo (+XP)
    const gameNotif: AppNotification = {
      id: `notif-solo-${sessionId || Date.now()}`,
      type: 'ELO_CHANGED',
      title: `Hoàn thành ván Solo (+${xpEarned} XP)`,
      body: `Thời gian: ${formatDuration(duration)} • Độ chính xác: ${accuracy}% • Nhận được +${xpEarned} XP.`,
      createdAt: new Date().toISOString(),
      isRead: false,
      payload: {
        type: 'ELO_CHANGED',
        delta: xpEarned,
        oldElo: updatedProfile.totalExp - xpEarned,
        newElo: updatedProfile.totalExp,
        source: 'SOLO',
        sourceId: sessionId || 'solo',
      },
    }
    createAndPublishNotification(gameNotif)

    // Kiểm tra nhiệm vụ hằng ngày
    const layout = (state.layout as string) ?? ''
    const difficulty = (state.level as string) ?? ''
    const matchedQuest = checkQuestCompletion(layout, difficulty)
    if (matchedQuest) {
      const completedQuest = markQuestComplete(matchedQuest.taskCode)
      if (completedQuest) {
        const questNotif: AppNotification = {
          id: `notif-quest-${Date.now()}`,
          type: 'TASK_COMPLETED',
          title: 'Hoàn thành nhiệm vụ hôm nay! 🎉',
          body: `${completedQuest.title} — +${completedQuest.xpReward} XP thưởng nhiệm vụ.`,
          createdAt: new Date().toISOString(),
          isRead: false,
          payload: {
            type: 'TASK_COMPLETED',
            taskCode: completedQuest.taskCode,
            taskDate: todayStr(),
          },
        }
        createAndPublishNotification(questNotif)
      }
    }

    // Nếu người chơi thăng cấp độ mới
    if (leveledUp) {
      const levelNotif: AppNotification = {
        id: `notif-level-${Date.now()}`,
        type: 'TIER_CHANGED',
        title: `Chúc mừng bạn đã lên Cấp ${newLevel}!`,
        body: `Bạn đã tích lũy đủ ${updatedProfile.totalExp} XP và mở khóa Cấp độ ${newLevel}.`,
        createdAt: new Date().toISOString(),
        isRead: false,
        payload: {
          type: 'TIER_CHANGED',
          oldTier: `Cấp ${oldLevel}`,
          newTier: `Cấp ${newLevel}`,
          direction: 'UP',
        },
      }
      createAndPublishNotification(levelNotif)
    }
  }, [user, sessionId, xpEarned, duration, accuracy, state.layout, state.level])

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
          <p
            className="offline-result-note"
            style={{ marginTop: 12, fontSize: '0.88rem', color: 'var(--muted)', textAlign: 'center' }}
          >
            ℹ️ Ván này được chơi ở chế độ Ngoại tuyến (Offline). Tiến trình và điểm kinh nghiệm đã được đồng bộ vào tài khoản của bạn trên trình duyệt.
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
