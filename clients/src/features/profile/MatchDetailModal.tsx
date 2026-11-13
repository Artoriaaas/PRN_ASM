import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { SudokuBoard } from '../../components/SudokuBoard'
import { getGameSession, SessionStatus } from '../../api/gameClient'
import { fetchMatchDetail, PlayFormat, MatchResult, type MatchDetail } from '../../api/multiClient'
import type { SessionState } from '../../gen/sudoku/game/v1/game_pb'

type MatchDetailModalProps = {
  open: boolean
  onClose: () => void
  selectedItem: {
    type: 'solo' | 'multiplayer'
    id: string
  } | null
}

function stringToBoardArray(str: string): Uint8Array {
  const arr = new Uint8Array(81)
  for (let i = 0; i < 81 && i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code >= 49 && code <= 57) {
      arr[i] = code - 48
    } else {
      arr[i] = 0
    }
  }
  return arr
}

function formatElapsed(ms: number | bigint): string {
  const totalSeconds = Math.max(0, Math.floor(Number(ms) / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getLevelName(levelId: string): string {
  switch (levelId.toLowerCase()) {
    case 'easy':
      return 'Dễ'
    case 'medium':
      return 'Trung bình'
    case 'hard':
      return 'Khó'
    case 'expert':
      return 'Chuyên gia'
    default:
      return levelId || 'Tiêu chuẩn'
  }
}

export function MatchDetailModal({ open, onClose, selectedItem }: MatchDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [soloSession, setSoloSession] = useState<SessionState | null>(null)
  const [multiMatch, setMultiMatch] = useState<MatchDetail | null>(null)

  useEffect(() => {
    if (!open || !selectedItem) {
      setSoloSession(null)
      setMultiMatch(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    if (selectedItem.type === 'solo') {
      getGameSession(selectedItem.id, controller.signal)
        .then((session) => {
          setSoloSession(session)
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setError(err instanceof Error ? err.message : 'Không thể tải chi tiết ván solo')
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    } else {
      fetchMatchDetail(selectedItem.id, controller.signal)
        .then((match) => {
          if (match) {
            setMultiMatch(match)
          } else {
            setError('Không tìm thấy dữ liệu trận đấu multiplayer')
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            setError(err instanceof Error ? err.message : 'Không thể tải chi tiết trận multiplayer')
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }

    return () => controller.abort()
  }, [open, selectedItem])

  if (!open || !selectedItem) return null

  const isSolo = selectedItem.type === 'solo'
  const title = isSolo ? 'Chi tiết ván Solo' : 'Chi tiết trận Multiplayer'

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="match-detail-container">
        {loading && (
          <div className="match-detail-loading" aria-live="polite">
            <div className="loader" />
            <p>Đang tải dữ liệu bàn cờ và trận đấu…</p>
          </div>
        )}

        {error && (
          <div className="match-detail-error" role="alert">
            <p>{error}</p>
            <button className="primary-button compact" type="button" onClick={onClose}>
              Đóng
            </button>
          </div>
        )}

        {!loading && !error && isSolo && soloSession && (
          <div className="match-detail-content">
            <div className="match-detail-header">
              <div className="match-tags">
                <span className="badge badge-level">{getLevelName(soloSession.levelId)}</span>
                <span className="badge badge-layout">
                  {soloSession.layoutType === 2 ? 'Shuffle (Bất quy tắc)' : 'Classic (Tiêu chuẩn)'}
                </span>
                <span
                  className={`badge badge-status ${
                    soloSession.status === SessionStatus.COMPLETED
                      ? 'win'
                      : soloSession.status === SessionStatus.FAILED
                      ? 'loss'
                      : 'abandoned'
                  }`}
                >
                  {soloSession.status === SessionStatus.COMPLETED
                    ? '✓ Hoàn thành'
                    : soloSession.status === SessionStatus.FAILED
                    ? '✗ Thất bại'
                    : '— Đã bỏ cuộc'}
                </span>
              </div>
            </div>

            <div className="match-detail-body">
              <div className="match-detail-board-wrap">
                <SudokuBoard
                  initial={soloSession.initialBoard}
                  cells={stringToBoardArray(soloSession.currentBoard || soloSession.initialBoard)}
                  notes={new Uint16Array(81)}
                  regionMap={soloSession.regionMap || undefined}
                  selected={null}
                  readOnly={true}
                  onSelect={() => {}}
                />
              </div>

              <div className="match-detail-stats">
                <h3>Thống kê ván chơi</h3>
                <div className="match-stats-grid">
                  <div className="stat-box">
                    <span className="stat-label">Thời gian giải</span>
                    <strong className="stat-val">{formatElapsed(soloSession.elapsedMs)}</strong>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Điểm số</span>
                    <strong className="stat-val highlight">{soloSession.score}</strong>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Độ chính xác</span>
                    <strong className="stat-val">
                      {Math.round(soloSession.accuracy * 100)}%
                    </strong>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Lỗi vi phạm</span>
                    <strong className="stat-val">
                      {soloSession.mistakesCount} / {soloSession.maxMistakes}
                    </strong>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Gợi ý đã dùng</span>
                    <strong className="stat-val">
                      {soloSession.hintsUsed} / {soloSession.maxHints}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && !isSolo && multiMatch && (
          <div className="match-detail-content">
            <div className="match-detail-header">
              <div className="match-tags">
                <span className="badge badge-format">
                  {multiMatch.playFormat === PlayFormat.DUEL ? '⚔️ Đối kháng (Duel)' : '⚡ Đua tốc độ (Race)'}
                </span>
                <span className="badge badge-level">{getLevelName(multiMatch.levelId)}</span>
                <span className="badge badge-layout">
                  {multiMatch.boardLayout === 2 ? 'Shuffle' : 'Classic'}
                </span>
                {multiMatch.endReason && (
                  <span className="badge badge-end-reason">{multiMatch.endReason}</span>
                )}
              </div>
            </div>

            <div className="match-detail-body">
              <div className="match-detail-board-wrap">
                <SudokuBoard
                  initial={multiMatch.initialBoard}
                  cells={stringToBoardArray(multiMatch.sharedBoard || multiMatch.initialBoard)}
                  notes={new Uint16Array(81)}
                  regionMap={multiMatch.regionMap || undefined}
                  selected={null}
                  readOnly={true}
                  onSelect={() => {}}
                />
              </div>

              <div className="match-detail-stats">
                <h3>Người chơi trong trận</h3>
                <div className="multi-players-list">
                  {multiMatch.players.map((p, idx) => {
                    const isWin = p.result === MatchResult.WIN
                    const isLoss = p.result === MatchResult.LOSS
                    return (
                      <div
                        key={p.userId || idx}
                        className={`player-result-card ${isWin ? 'winner' : isLoss ? 'loser' : ''}`}
                      >
                        <div className="player-result-head">
                          <div>
                            <strong>{p.displayName || `Người chơi ${idx + 1}`}</strong>
                            {p.ratingDelta !== 0 && (
                              <span
                                className={`rating-delta ${p.ratingDelta > 0 ? 'pos' : 'neg'}`}
                              >
                                {p.ratingDelta > 0 ? `+${p.ratingDelta}` : p.ratingDelta} ELO
                              </span>
                            )}
                          </div>
                          <span
                            className={`badge badge-result ${
                              isWin ? 'win' : isLoss ? 'loss' : 'draw'
                            }`}
                          >
                            {isWin ? 'Thắng cuộc' : isLoss ? 'Thất bại' : 'Hòa'}
                          </span>
                        </div>

                        <div className="player-metrics">
                          <div>
                            <span>Điểm</span>
                            <strong>{p.score}</strong>
                          </div>
                          <div>
                            <span>Ô đúng</span>
                            <strong>{p.correctCells}</strong>
                          </div>
                          <div>
                            <span>Lỗi</span>
                            <strong>{p.mistakesCount}</strong>
                          </div>
                          <div>
                            <span>Thời gian</span>
                            <strong>{formatElapsed(p.completionMs || multiMatch.durationMs)}</strong>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
