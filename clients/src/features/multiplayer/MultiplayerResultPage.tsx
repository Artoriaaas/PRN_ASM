import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom'
import type { UserProfile } from '../../gen/sudoku/user/v1/user_pb'
import {
  PlayFormat,
  BoardLayoutType,
  MatchResult,
  fetchMatchDetail,
  resolveLevelFromElo,
} from '../../api/multiClient'
import {
  matchHub,
  type MatchEndedPayload,
  type MatchStartedPayload,
} from '../../realtime/matchHubClient'

type MultiplayerResultPageProps = {
  profile: UserProfile | null
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(1, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function translateReason(reason: string): string {
  switch (reason) {
    case 'completed':
    case 'board_completed':
      return 'Hoàn thành bàn cờ Sudoku'
    case 'opponent_out_of_lives':
    case 'out_of_lives':
      return 'Hết 3 mạng cho phép'
    case 'resigned':
      return 'Người chơi đầu hàng'
    case 'timeout':
    case 'match_timeout':
      return 'Hết thời gian thi đấu'
    case 'disconnect_timeout':
      return 'Mất kết nối quá 30 giây'
    default:
      return 'Kết thúc ván đấu'
  }
}

export function MultiplayerResultPage({ profile }: MultiplayerResultPageProps) {
  const { matchId = '' } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const locState = location.state as {
    result?: MatchEndedPayload
    match?: MatchStartedPayload
  } | null

  const [result, setResult] = useState<MatchEndedPayload | null>(
    () => locState?.result || matchHub.getMatchResult(matchId) || matchHub.getMatchResult(),
  )
  const [matchInfo] = useState<MatchStartedPayload | null>(
    () => locState?.match || matchHub.getActiveMatch(matchId) || matchHub.getActiveMatch(),
  )

  useEffect(() => {
    if (result) return
    const controller = new AbortController()
    fetchMatchDetail(matchId, controller.signal).then((detail) => {
      if (!detail || controller.signal.aborted) return
      const p1 = detail.players[0]
      const p2 = detail.players[1]
      if (p1 && p2) {
        const isDrawDetail =
          p1.result === MatchResult.DRAW || p2.result === MatchResult.DRAW
        const winnerUid =
          p1.result === MatchResult.WIN
            ? p1.userId
            : p2.result === MatchResult.WIN
              ? p2.userId
              : ''
        setResult({
          matchId: detail.matchId,
          playFormat: detail.playFormat,
          boardLayout: detail.boardLayout,
          levelId: detail.levelId,
          isDraw: isDrawDetail,
          winnerUserId: winnerUid,
          reason: detail.endReason,
          durationMs: Number(detail.durationMs || 60000n),
          player1: {
            result: Number(p1.result),
            ratingBefore: p1.ratingBefore,
            eloDelta: p1.ratingDelta,
            newRating: p1.ratingBefore + p1.ratingDelta,
            score: p1.score,
            lives: p1.livesRemaining,
            mistakes: p1.mistakesCount,
          },
          player2: {
            result: Number(p2.result),
            ratingBefore: p2.ratingBefore,
            eloDelta: p2.ratingDelta,
            newRating: p2.ratingBefore + p2.ratingDelta,
            score: p2.score,
            lives: p2.livesRemaining,
            mistakes: p2.mistakesCount,
          },
        })
      }
    })
    return () => controller.abort()
  }, [matchId, result])

  if (!result) {
    return (
      <div className="multi-result-page">
        <div className="multi-result-card">
          <h2>Không tìm thấy kết quả trận đấu</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>
            Trận đấu này đã kết thúc hoặc chưa có dữ liệu lưu trữ.
          </p>
          <Link to="/play" className="btn btn-primary">
            Quay về Sảnh Multiplayer
          </Link>
        </div>
      </div>
    )
  }

  const callerIdentity = matchHub.getCallerIdentity(profile?.displayName)
  const myUid = callerIdentity.userId
  const isP1Me = matchInfo
    ? matchInfo.player1.userId === myUid || matchInfo.player2.userId !== myUid
    : true

  const myStats = isP1Me ? result.player1 : result.player2
  const oppStats = isP1Me ? result.player2 : result.player1

  const myName =
    (isP1Me ? matchInfo?.player1.displayName : matchInfo?.player2.displayName) ||
    profile?.displayName ||
    callerIdentity.displayName
  const oppName =
    (isP1Me ? matchInfo?.player2.displayName : matchInfo?.player1.displayName) ||
    'Đối thủ'

  const isWin =
    !result.isDraw &&
    (result.winnerUserId === myUid || (isP1Me && myStats.eloDelta > 0))
  const isDraw = result.isDraw

  const isDuel = result.playFormat === PlayFormat.DUEL
  const isIrregular = result.boardLayout === BoardLayoutType.IRREGULAR
  const newEloTier = resolveLevelFromElo(myStats.newRating)

  function handlePlayAgain() {
    const modeStr = isDuel ? 'duel' : 'race'
    const layoutStr = isIrregular ? 'irregular' : 'standard'
    navigate(`/play/queue?mode=${modeStr}&layout=${layoutStr}`)
  }

  return (
    <div className="multi-result-page">
      <div className={`multi-result-card ${isDraw ? 'draw' : isWin ? 'win' : 'loss'}`}>
        <div className="result-outcome-banner">
          <span className="result-outcome-icon" aria-hidden="true">
            {isDraw ? '🤝' : isWin ? '🏆' : '🛡️'}
          </span>
          <p className="eyebrow">
            {isDuel ? '⚔️ KẾT QUẢ TRẬN DUEL' : '⚡ KẾT QUẢ TRẬN RACE'}
          </p>
          <h1>{isDraw ? 'HÒA TRẬN' : isWin ? 'CHIẾN THẮNG!' : 'THẤT BẠI'}</h1>
          <p className="result-reason-text">
            {translateReason(result.reason)} · Thời gian:{' '}
            <strong>{formatDuration(result.durationMs)}</strong>
          </p>
        </div>

        {/* So sánh Bản thân (Trái) vs Đối thủ (Phải) */}
        <div className="result-vs-comparison">
          <div className="result-player-box self">
            <span className="vs-side-tag self">BẠN</span>
            <div className="queue-avatar large self">
              <span>{(myName[0] || 'B').toUpperCase()}</span>
            </div>
            <h3>{myName}</h3>

            <div className="result-elo-change">
              <span className="elo-new">{myStats.newRating} ELO</span>
              <span
                className={`elo-delta-pill ${myStats.eloDelta >= 0 ? 'pos' : 'neg'}`}
              >
                {myStats.eloDelta >= 0 ? `+${myStats.eloDelta}` : myStats.eloDelta}
              </span>
            </div>

            <div className="result-stat-list">
              <div>
                <span>Điểm số</span>
                <strong>{myStats.score}</strong>
              </div>
              <div>
                <span>Mạng còn</span>
                <strong>{myStats.lives}/3 ♥</strong>
              </div>
              <div>
                <span>Số lỗi</span>
                <strong>{myStats.mistakes}</strong>
              </div>
            </div>
          </div>

          <div className="result-vs-divider">VS</div>

          <div className="result-player-box opponent">
            <span className="vs-side-tag opponent">ĐỐI THỦ</span>
            <div className="queue-avatar large opponent">
              <span>{(oppName[0] || 'Đ').toUpperCase()}</span>
            </div>
            <h3>{oppName}</h3>

            <div className="result-elo-change">
              <span className="elo-new">{oppStats.newRating} ELO</span>
              <span
                className={`elo-delta-pill ${oppStats.eloDelta >= 0 ? 'pos' : 'neg'}`}
              >
                {oppStats.eloDelta >= 0 ? `+${oppStats.eloDelta}` : oppStats.eloDelta}
              </span>
            </div>

            <div className="result-stat-list">
              <div>
                <span>Điểm số</span>
                <strong>{oppStats.score}</strong>
              </div>
              <div>
                <span>Mạng còn</span>
                <strong>{oppStats.lives}/3 ♥</strong>
              </div>
              <div>
                <span>Số lỗi</span>
                <strong>{oppStats.mistakes}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="result-next-difficulty-note">
          Cấp bậc hiện tại: <strong>{newEloTier.rankTitle}</strong> · Độ khó ghép trận
          tiếp theo:{' '}
          <strong style={{ color: newEloTier.color }}>{newEloTier.label}</strong>
        </div>

        <div className="result-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={handlePlayAgain}
          >
            🔄 Tìm trận {isDuel ? 'Duel' : 'Race'} tiếp
          </button>
          <Link to="/play" className="btn btn-ghost btn-lg">
            🎮 Về Sảnh 4 chế độ
          </Link>
        </div>
      </div>
    </div>
  )
}
