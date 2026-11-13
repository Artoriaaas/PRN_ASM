import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startGameSession, LayoutType } from '../../api/gameClient'
import { createOfflineSession } from '../../lib/offlineSudoku'
import type { DailyQuest } from './questSystem'
import {
  DIFFICULTY_LABELS,
  LAYOUT_LABELS,
  todayStr,
} from './questSystem'
import './quests.css'

interface QuestsModalProps {
  quests: DailyQuest[]
  onClose: () => void
}

function diffBadgeClass(diff: DailyQuest['difficulty']): string {
  return `badge badge-diff-${diff}`
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

export function QuestsModal({ quests, onClose }: QuestsModalProps) {
  const navigate = useNavigate()
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const completed = quests.filter((q) => q.status === 'completed').length
  const total = quests.length
  const allDone = completed === total
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0

  // Đóng khi bấm Esc
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Focus trap cơ bản: focus vào nút đóng khi mở
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  const [startingId, setStartingId] = useState<string | null>(null)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  async function handlePlay(quest: DailyQuest) {
    if (startingId) return
    setStartingId(quest.id)
    const layoutType = quest.boardLayout === 'standard' ? LayoutType.STANDARD : LayoutType.IRREGULAR

    try {
      const session = await startGameSession(quest.difficulty, layoutType)
      navigate(`/solo/${session.sessionId}`, {
        state: {
          session,
          layout: quest.boardLayout,
          level: quest.difficulty,
          isOffline: false,
          tutorial: null,
          fromQuest: quest.taskCode,
        },
      })
    } catch (err) {
      console.warn('GameService connection failed, starting offline session:', err)
      const offlineSession = createOfflineSession(quest.difficulty, layoutType)
      navigate(`/solo/${offlineSession.sessionId}`, {
        state: {
          session: offlineSession,
          layout: quest.boardLayout,
          level: quest.difficulty,
          isOffline: true,
          tutorial: null,
          fromQuest: quest.taskCode,
        },
      })
    } finally {
      setStartingId(null)
    }
  }

  return (
    <div
      className="quests-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qm-title"
    >
      <div className="quests-modal">
        {/* Header */}
        <div className="qm-header">
          <span className="qm-header-icon" aria-hidden="true">⚡</span>
          <div className="qm-header-text">
            <h2 className="qm-title" id="qm-title">Nhiệm vụ hằng ngày</h2>
            <p className="qm-date">Hôm nay: {formatDate(todayStr())} • {completed}/{total} hoàn thành</p>
          </div>
          <button
            type="button"
            className="qm-close"
            onClick={onClose}
            ref={closeRef}
            aria-label="Đóng bảng nhiệm vụ"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="qm-progress-bar" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ nhiệm vụ">
          <div className="qm-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Body */}
        <div className="qm-body">
          {allDone ? (
            <div className="qm-all-done">
              <div className="qm-all-done-emoji">🎉</div>
              <h3>Tuyệt vời! Bạn đã hoàn thành hết nhiệm vụ hôm nay.</h3>
              <p>Quay lại vào ngày mai để nhận nhiệm vụ mới và tích lũy thêm XP.</p>
            </div>
          ) : (
            quests.map((quest) => (
              <div
                key={quest.id}
                className={`quest-card${quest.status === 'completed' ? ' completed' : ''}`}
              >
                {/* Status icon */}
                <div className={`quest-status-icon ${quest.status}`} aria-hidden="true">
                  {quest.status === 'completed' ? '✓' : '○'}
                </div>

                {/* Info */}
                <div className="quest-info">
                  <p className={`quest-title${quest.status === 'completed' ? ' completed' : ''}`}>
                    {quest.title}
                  </p>
                  <p className="quest-desc">{quest.description}</p>
                  <div className="quest-badges">
                    <span className="badge badge-layout">
                      {LAYOUT_LABELS[quest.boardLayout]}
                    </span>
                    <span className={diffBadgeClass(quest.difficulty)}>
                      {DIFFICULTY_LABELS[quest.difficulty]}
                    </span>
                    <span className="badge badge-xp">
                      ⭐ +{quest.xpReward} XP
                    </span>
                  </div>
                </div>

                {/* Action */}
                <div className="quest-action">
                  {quest.status === 'completed' ? (
                    <span className="quest-done-label">✓ Xong</span>
                  ) : (
                    <button
                      type="button"
                      className="quest-play-btn"
                      onClick={() => void handlePlay(quest)}
                      disabled={Boolean(startingId)}
                      aria-label={`Chơi nhiệm vụ: ${quest.title}`}
                    >
                      {startingId === quest.id ? 'Đang vào…' : 'Chơi →'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="qm-footer">
          <p className="qm-footer-note">🕐 Nhiệm vụ làm mới lúc 00:00 mỗi ngày</p>
          <button type="button" className="qm-close-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

