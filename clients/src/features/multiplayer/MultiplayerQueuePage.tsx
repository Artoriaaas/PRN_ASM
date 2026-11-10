import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { UserProfile } from '../../gen/sudoku/user/v1/user_pb'
import {
  PlayFormat,
  BoardLayoutType,
  getCachedRatingsSync,
  resolveLevelFromElo,
} from '../../api/multiClient'
import {
  matchHub,
  type MatchStartedPayload,
  type CustomRoomCreatedPayload,
} from '../../realtime/matchHubClient'
import { useToast } from '../../components/ui/Toast'

type MultiplayerQueuePageProps = {
  profile: UserProfile | null
}

function renderAvatar(name: string, avatarUrl?: string, extraClass = '') {
  const initial = (name.trim()[0] || 'P').toUpperCase()
  if (avatarUrl) {
    return (
      <div className={`queue-avatar ${extraClass}`}>
        <img src={avatarUrl} alt={name} />
      </div>
    )
  }
  return (
    <div className={`queue-avatar ${extraClass}`} aria-hidden="true">
      <span>{initial}</span>
    </div>
  )
}

export function MultiplayerQueuePage({ profile }: MultiplayerQueuePageProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const showToast = useToast()

  const modeParam = searchParams.get('mode') === 'duel' ? 'duel' : 'race'
  const layoutParam = searchParams.get('layout') === 'irregular' ? 'irregular' : 'standard'
  const roomAction = searchParams.get('room') // 'create' | 'join' | null
  const roomCodeToJoin = searchParams.get('code') || ''
  const customLevelParam = searchParams.get('level') || ''

  const playFormat = modeParam === 'duel' ? PlayFormat.DUEL : PlayFormat.RACE
  const boardLayout =
    layoutParam === 'irregular' ? BoardLayoutType.IRREGULAR : BoardLayoutType.STANDARD

  const ratings = getCachedRatingsSync()
  const myElo = playFormat === PlayFormat.DUEL ? ratings.duel : ratings.race
  const eloDifficulty = resolveLevelFromElo(myElo)
  const effectiveLevelId = customLevelParam || eloDifficulty.levelId

  const callerIdentity = matchHub.getCallerIdentity(profile?.displayName)
  const myDisplayName = profile?.displayName || callerIdentity.displayName
  const myAvatarUrl = profile?.avatarUrl || callerIdentity.avatarUrl

  const [elapsedSec, setElapsedSec] = useState(0)
  const [createdRoom, setCreatedRoom] = useState<CustomRoomCreatedPayload | null>(null)
  const [matchedPayload, setMatchedPayload] = useState<MatchStartedPayload | null>(null)
  const [countdown, setCountdown] = useState<number>(5)
  const [isCancelling, setIsCancelling] = useState(false)
  const hasNavigatedRef = useRef(false)

  // Listen for MatchFound and startqueue / custom room
  useEffect(() => {
    let active = true

    const unsubMatch = matchHub.onMatchFound((payload) => {
      if (!active) return
      setMatchedPayload(payload)
      setCountdown(payload.rules?.countdownSeconds || 5)
    })

    async function initMatchmaking() {
      if (roomAction === 'create') {
        try {
          const room = await matchHub.createCustomRoom({
            format: playFormat,
            layout: boardLayout,
            level: effectiveLevelId,
            displayName: myDisplayName,
          })
          if (active) {
            setCreatedRoom(room)
          }
        } catch (err) {
          if (active) {
            showToast(
              err instanceof Error ? err.message : 'Không thể tạo phòng tùy chỉnh.',
              'error',
            )
            navigate('/play', { replace: true })
          }
        }
      } else if (roomAction === 'join' && roomCodeToJoin) {
        try {
          await matchHub.joinCustomRoom(roomCodeToJoin, myDisplayName)
        } catch (err) {
          if (active) {
            showToast(
              err instanceof Error
                ? err.message
                : `Không tìm thấy phòng '${roomCodeToJoin}'.`,
              'error',
            )
            navigate('/play', { replace: true })
          }
        }
      } else {
        await matchHub.joinQueue({
          format: playFormat,
          layout: boardLayout,
          level: eloDifficulty.levelId,
          displayName: myDisplayName,
        })
      }
    }

    initMatchmaking()

    return () => {
      active = false
      unsubMatch()
    }
  }, [
    playFormat,
    boardLayout,
    roomAction,
    roomCodeToJoin,
    effectiveLevelId,
    eloDifficulty.levelId,
    myDisplayName,
    navigate,
    showToast,
  ])

  // Elapsed wait timer while searching
  useEffect(() => {
    if (matchedPayload) return
    const timer = window.setInterval(() => {
      setElapsedSec((s) => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [matchedPayload])

  // 5-second countdown once matched -> enter match
  useEffect(() => {
    if (!matchedPayload) return

    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          if (!hasNavigatedRef.current) {
            hasNavigatedRef.current = true
            navigate(`/match/${matchedPayload.matchId}`, {
              replace: true,
              state: { match: matchedPayload },
            })
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [matchedPayload, navigate])

  async function handleCancel() {
    if (isCancelling) return
    setIsCancelling(true)
    if (createdRoom) {
      await matchHub.leaveCustomRoom(createdRoom.roomCode)
    } else {
      await matchHub.leaveQueue()
    }
    navigate('/play', { replace: true })
  }

  function handleCopyRoomCode() {
    if (!createdRoom) return
    const code = createdRoom.roomCode

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Đã sao chép mã phòng: ${code}`, 'success')
      }).catch(() => {
        fallbackCopyText(code)
      })
      return
    }

    fallbackCopyText(code)
  }

  function fallbackCopyText(text: string) {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      if (successful) {
        showToast(`Đã sao chép mã phòng: ${text}`, 'success')
      } else {
        showToast(`Mã phòng của bạn: ${text}`, 'info')
      }
    } catch {
      showToast(`Mã phòng của bạn: ${text}`, 'info')
    }
  }
  function handlePlayWithBotNow() {
    matchHub.startSimulatedMatch({
      format: playFormat,
      layout: boardLayout,
      levelId: effectiveLevelId,
      displayName: myDisplayName,
      roomCode: createdRoom?.roomCode,
    })
  }

  const formatWaitTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // Determine Self (left) vs Opponent (right) when matched
  const myUid = callerIdentity.userId
  const isP1Me =
    matchedPayload
      ? matchedPayload.player1.userId === myUid ||
        matchedPayload.player2.userId !== myUid
      : true
  const mePlayer = matchedPayload
    ? isP1Me
      ? matchedPayload.player1
      : matchedPayload.player2
    : null
  const oppPlayer = matchedPayload
    ? isP1Me
      ? matchedPayload.player2
      : matchedPayload.player1
    : null

  const matchedLevelInfo = resolveLevelFromElo(
    matchedPayload ? Math.min(matchedPayload.player1.rating, matchedPayload.player2.rating) : myElo,
  )

  return (
    <div className="multi-queue-page">
      {/* Header chế độ ghép trận */}
      <div className="queue-header">
        <span className={`queue-mode-pill ${modeParam}`}>
          {playFormat === PlayFormat.DUEL ? '⚔️ CHẾ ĐỘ DUEL' : '⚡ CHẾ ĐỘ RACE'}
        </span>
        <span className="queue-meta-pill">
          {boardLayout === BoardLayoutType.IRREGULAR ? '◈ Irregular' : '▦ Standard 3×3'}
        </span>
        <span
          className="queue-meta-pill"
          style={{ borderColor: eloDifficulty.color, color: eloDifficulty.color }}
        >
          Độ khó theo Elo: {eloDifficulty.label}
        </span>
      </div>

      {!matchedPayload ? (
        /* ── TRẠNG THÁI 1: ĐANG TÌM TRẬN (Avatar + Tên + Elo ở chính giữa màn hình) ── */
        <div className="queue-searching-stage" aria-live="polite">
          {createdRoom && (
            <div className="custom-room-banner">
              <span className="custom-room-banner-label">MÃ PHÒNG CỦA BẠN (6 KÝ TỰ)</span>
              <div className="custom-room-code-box">
                <strong className="custom-room-code-text">{createdRoom.roomCode}</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleCopyRoomCode}
                >
                  📋 Sao chép mã
                </button>
              </div>
              <p className="custom-room-banner-hint">
                Gửi mã này cho bạn bè nhập ở mục <b>Custom Room → Nhập mã phòng</b> (hoặc mở tab trình duyệt thứ 2 để vào phòng).
              </p>
            </div>
          )}

          <div className="queue-center-player-card">
            <div className="queue-radar-wrapper">
              <div className="queue-radar-ring ring-1" />
              <div className="queue-radar-ring ring-2" />
              {renderAvatar(myDisplayName, myAvatarUrl, 'large self')}
            </div>

            <h2 className="queue-player-name">{myDisplayName}</h2>

            <div className="queue-player-elo-chip">
              <span className="elo-icon" aria-hidden="true">🏅</span>
              <strong>{myElo} ELO</strong>
              <span className="elo-tier-sep">·</span>
              <span>{eloDifficulty.rankTitle}</span>
            </div>

            <div className="queue-auto-difficulty-note">
              Độ khó ván đấu tự động theo Elo:{' '}
              <strong style={{ color: eloDifficulty.color }}>{eloDifficulty.label}</strong>
            </div>
          </div>

          <div className="queue-status-box">
            <div className="queue-spinner-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="queue-status-text">
              {createdRoom
                ? 'Đang chờ người chơi thứ 2 nhập mã vào phòng...'
                : 'Đang tìm đối thủ có mức Elo tương đương...'}
            </p>
            <span className="queue-wait-clock">{formatWaitTime(elapsedSec)}</span>
          </div>

          <div className="queue-actions">
            {createdRoom && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePlayWithBotNow}
              >
                🤖 Đấu thử với Bot ngay
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              ✕ Hủy tìm trận
            </button>
          </div>
        </div>
      ) : (
        /* ── TRẠNG THÁI 2: ĐÃ GHÉP XONG (Trái: Bản thân | Giữa: 5s Countdown | Phải: Đối thủ) ── */
        <div className="queue-vs-stage" aria-live="assertive">
          <div className="vs-found-banner">
            <span className="eyebrow">ĐÃ TÌM THẤY ĐỐI THỦ!</span>
            <h2>Chuẩn bị bước vào trận đấu</h2>
          </div>

          <div className="vs-arena-grid">
            {/* BÊN TRÁI: BẢN THÂN */}
            <div className="vs-fighter-card self-side">
              <span className="vs-side-tag self">BẠN</span>
              {renderAvatar(
                mePlayer?.displayName || myDisplayName,
                myAvatarUrl,
                'large self',
              )}
              <h3 className="vs-fighter-name">
                {mePlayer?.displayName || myDisplayName}
              </h3>
              <div className="vs-fighter-elo self">
                <span>Điểm xếp hạng</span>
                <strong>{mePlayer?.rating ?? myElo} ELO</strong>
              </div>
            </div>

            {/* Ở GIỮA: VS + ĐẾM NGƯỢC 5 GIÂY */}
            <div className="vs-center-column">
              <div className="vs-emblem">VS</div>
              <div className="vs-countdown-ring" role="timer" aria-label={`Vào trận sau ${countdown} giây`}>
                <span className="vs-countdown-number">{countdown}</span>
                <span className="vs-countdown-unit">GIÂY</span>
              </div>
              <p className="vs-match-summary">
                Vào trận sau <strong>{countdown}s</strong> · Độ khó:{' '}
                <strong style={{ color: matchedLevelInfo.color }}>
                  {matchedPayload.levelId.toUpperCase()}
                </strong>
              </p>
            </div>

            {/* BÊN PHẢI: ĐỐI THỦ */}
            <div className="vs-fighter-card opponent-side">
              <span className="vs-side-tag opponent">ĐỐI THỦ</span>
              {renderAvatar(
                oppPlayer?.displayName || 'Đối thủ',
                oppPlayer?.avatarUrl,
                'large opponent',
              )}
              <h3 className="vs-fighter-name">
                {oppPlayer?.displayName || 'Đối thủ'}
              </h3>
              <div className="vs-fighter-elo opponent">
                <span>Điểm xếp hạng</span>
                <strong>{oppPlayer?.rating ?? 1000} ELO</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
