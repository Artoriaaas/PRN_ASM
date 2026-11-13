import { useEffect, useState, useCallback, useRef } from 'react'
import {
  fetchGameHistory,
  SessionStatus,
  type GameHistoryItem,
} from '../../api/gameClient'
import {
  fetchMatchHistoryPaged,
  fetchPlayerRatings,
  PlayFormat,
  MatchResult,
  type MatchHistoryItem,
  type PlayerRatingsSummary,
} from '../../api/multiClient'
import { MatchDetailModal } from './MatchDetailModal'
import './matchHistory.css'

const PAGE_SIZE = 12

function formatDateTime(isoString: string): string {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  } catch {
    return isoString
  }
}

function formatDurationSec(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

function getLevelLabel(levelId: string): string {
  switch (levelId?.toLowerCase()) {
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

export function MatchHistorySection() {
  const [activeTab, setActiveTab] = useState<'solo' | 'multi'>('solo')
  const [multiFormatFilter, setMultiFormatFilter] = useState<PlayFormat>(PlayFormat.UNSPECIFIED)

  // Solo state
  const [soloItems, setSoloItems] = useState<GameHistoryItem[]>([])
  const [soloTotal, setSoloTotal] = useState(0)
  const [soloWins, setSoloWins] = useState(0)
  const [loadingSolo, setLoadingSolo] = useState(false)
  const [loadingMoreSolo, setLoadingMoreSolo] = useState(false)
  const [soloError, setSoloError] = useState<string | null>(null)

  // Multi state
  const [multiItems, setMultiItems] = useState<MatchHistoryItem[]>([])
  const [multiTotal, setMultiTotal] = useState(0)
  const [multiWins, setMultiWins] = useState(0)
  const [multiRatings, setMultiRatings] = useState<PlayerRatingsSummary | null>(null)
  const [loadingMulti, setLoadingMulti] = useState(false)
  const [loadingMoreMulti, setLoadingMoreMulti] = useState(false)
  const [multiError, setMultiError] = useState<string | null>(null)

  // Modal detail state
  const [selectedMatch, setSelectedMatch] = useState<{
    type: 'solo' | 'multiplayer'
    id: string
  } | null>(null)

  const soloOffsetRef = useRef(0)
  const multiOffsetRef = useRef(0)

  // Load initial Solo
  const loadInitialSolo = useCallback(async (signal?: AbortSignal) => {
    setLoadingSolo(true)
    setSoloError(null)
    soloOffsetRef.current = 0
    try {
      const res = await fetchGameHistory(PAGE_SIZE, 0, signal)
      setSoloItems(res.items)
      setSoloTotal(res.totalCount)
      setSoloWins(res.winsCount)
      soloOffsetRef.current = res.items.length
    } catch (err) {
      if (!signal?.aborted) {
        setSoloError(err instanceof Error ? err.message : 'Lỗi tải lịch sử Solo')
      }
    } finally {
      if (!signal?.aborted) setLoadingSolo(false)
    }
  }, [])

  // Load more Solo
  const handleLoadMoreSolo = async () => {
    if (loadingMoreSolo || soloItems.length >= soloTotal) return
    setLoadingMoreSolo(true)
    try {
      const res = await fetchGameHistory(PAGE_SIZE, soloOffsetRef.current)
      setSoloItems((prev) => [...prev, ...res.items])
      setSoloTotal(res.totalCount)
      setSoloWins(res.winsCount)
      soloOffsetRef.current += res.items.length
    } catch {
      // silent or keep current
    } finally {
      setLoadingMoreSolo(false)
    }
  }

  // Load initial Multi
  const loadInitialMulti = useCallback(async (format: PlayFormat, signal?: AbortSignal) => {
    setLoadingMulti(true)
    setMultiError(null)
    multiOffsetRef.current = 0
    try {
      const [historyRes, ratingsRes] = await Promise.all([
        fetchMatchHistoryPaged(format, PAGE_SIZE, 0, signal),
        fetchPlayerRatings(signal).catch(() => null),
      ])
      setMultiItems(historyRes.matches)
      setMultiTotal(historyRes.totalCount)
      setMultiWins(historyRes.winsCount)
      multiOffsetRef.current = historyRes.matches.length
      if (ratingsRes) setMultiRatings(ratingsRes)
    } catch (err) {
      if (!signal?.aborted) {
        setMultiError(err instanceof Error ? err.message : 'Lỗi tải lịch sử Multiplayer')
      }
    } finally {
      if (!signal?.aborted) setLoadingMulti(false)
    }
  }, [])

  // Load more Multi
  const handleLoadMoreMulti = async () => {
    if (loadingMoreMulti || multiItems.length >= multiTotal) return
    setLoadingMoreMulti(true)
    try {
      const res = await fetchMatchHistoryPaged(
        multiFormatFilter,
        PAGE_SIZE,
        multiOffsetRef.current,
      )
      setMultiItems((prev) => [...prev, ...res.matches])
      setMultiTotal(res.totalCount)
      setMultiWins(res.winsCount)
      multiOffsetRef.current += res.matches.length
    } catch {
      // silent
    } finally {
      setLoadingMoreMulti(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    if (activeTab === 'solo') {
      loadInitialSolo(controller.signal)
    } else {
      loadInitialMulti(multiFormatFilter, controller.signal)
    }
    return () => controller.abort()
  }, [activeTab, multiFormatFilter, loadInitialSolo, loadInitialMulti])

  const soloWinRate = soloTotal > 0 ? Math.round((soloWins / soloTotal) * 100) : 0
  const multiWinRate = multiTotal > 0 ? Math.round((multiWins / multiTotal) * 100) : 0

  return (
    <section className="match-history-section">
      <div className="history-header">
        <div className="history-title-wrap">
          <p className="eyebrow">NHẬT KÝ CHIẾN TÍCH</p>
          <h2>Lịch sử đấu</h2>
        </div>

        <div className="history-tab-group" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'solo'}
            className={`history-subtab ${activeTab === 'solo' ? 'active' : ''}`}
            onClick={() => setActiveTab('solo')}
          >
            🧩 Solo ({soloTotal})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'multi'}
            className={`history-subtab ${activeTab === 'multi' ? 'active' : ''}`}
            onClick={() => setActiveTab('multi')}
          >
            ⚔️ Multiplayer ({multiTotal})
          </button>
        </div>
      </div>

      {activeTab === 'solo' && (
        <div className="history-tab-pane">
          {/* Solo summary cards */}
          <div className="history-stats-bar">
            <div className="h-stat-card">
              <span className="h-stat-icon">🎮</span>
              <div>
                <strong>{soloTotal}</strong>
                <p>Tổng ván Solo</p>
              </div>
            </div>
            <div className="h-stat-card">
              <span className="h-stat-icon">✓</span>
              <div>
                <strong>{soloWins}</strong>
                <p>Chiến thắng</p>
              </div>
            </div>
            <div className="h-stat-card">
              <span className="h-stat-icon">📊</span>
              <div>
                <strong className="win-rate">{soloWinRate}%</strong>
                <p>Tỉ lệ thắng</p>
              </div>
            </div>
          </div>

          {/* Solo items */}
          {loadingSolo && (
            <div className="history-loading">
              <div className="loader" />
              <p>Đang tải lịch sử ván Solo…</p>
            </div>
          )}

          {soloError && (
            <div className="history-error">
              <p>{soloError}</p>
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => loadInitialSolo()}
              >
                Thử lại
              </button>
            </div>
          )}

          {!loadingSolo && !soloError && soloItems.length === 0 && (
            <div className="history-empty">
              <span className="empty-icon">🧩</span>
              <h3>Chưa có ván Solo nào được ghi nhận</h3>
              <p>Hãy bắt đầu một ván chơi mới tại mục Chơi Solo để lưu chiến tích của bạn!</p>
            </div>
          )}

          {!loadingSolo && !soloError && soloItems.length > 0 && (
            <div className="history-list">
              {soloItems.map((item) => {
                const isWin = item.status === SessionStatus.COMPLETED
                const isLoss = item.status === SessionStatus.FAILED
                return (
                  <article
                    key={item.sessionId}
                    className={`history-row ${isWin ? 'win-row' : isLoss ? 'loss-row' : 'abandoned-row'}`}
                    onClick={() => setSelectedMatch({ type: 'solo', id: item.sessionId })}
                  >
                    <div className="row-badge-col">
                      <span
                        className={`status-pill ${
                          isWin ? 'pill-win' : isLoss ? 'pill-loss' : 'pill-abandoned'
                        }`}
                      >
                        {isWin ? 'Thắng' : isLoss ? 'Thất bại' : 'Bỏ cuộc'}
                      </span>
                    </div>

                    <div className="row-info-col">
                      <div className="row-main-title">
                        <strong>Mức độ {getLevelLabel(item.levelId)}</strong>
                        <span className="layout-tag">
                          {item.layoutType === 2 ? 'Shuffle' : 'Classic'}
                        </span>
                      </div>
                      <span className="row-timestamp">{formatDateTime(item.finishedAt || item.startedAt)}</span>
                    </div>

                    <div className="row-metrics-col">
                      <div>
                        <span>Điểm</span>
                        <strong>{item.score}</strong>
                      </div>
                      <div>
                        <span>Thời gian</span>
                        <strong>{formatDurationSec(Math.floor(Number(item.elapsedMs) / 1000))}</strong>
                      </div>
                      <div>
                        <span>Lỗi</span>
                        <strong>{item.mistakesCount}</strong>
                      </div>
                    </div>

                    <div className="row-action-col">
                      <button
                        type="button"
                        className="btn-view-detail"
                        aria-label="Xem chi tiết ván đấu"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedMatch({ type: 'solo', id: item.sessionId })
                        }}
                      >
                        Chi tiết →
                      </button>
                    </div>
                  </article>
                )
              })}

              {soloItems.length < soloTotal && (
                <div className="load-more-wrap">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={loadingMoreSolo}
                    onClick={handleLoadMoreSolo}
                  >
                    {loadingMoreSolo ? 'Đang tải thêm…' : `Xem thêm (${soloItems.length}/${soloTotal})`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'multi' && (
        <div className="history-tab-pane">
          {/* Multi summary cards */}
          <div className="history-stats-bar multi-stats">
            <div className="h-stat-card">
              <span className="h-stat-icon">⚡</span>
              <div>
                <strong>{multiRatings?.race ?? 1000}</strong>
                <p>ELO Đua tốc độ ({multiRatings?.raceWins ?? 0}/{multiRatings?.racePlayed ?? 0} thắng)</p>
              </div>
            </div>
            <div className="h-stat-card">
              <span className="h-stat-icon">⚔️</span>
              <div>
                <strong>{multiRatings?.duel ?? 1000}</strong>
                <p>ELO Đối kháng ({multiRatings?.duelWins ?? 0}/{multiRatings?.duelPlayed ?? 0} thắng)</p>
              </div>
            </div>
            <div className="h-stat-card">
              <span className="h-stat-icon">🎯</span>
              <div>
                <strong className="win-rate">{multiWinRate}%</strong>
                <p>Tỉ lệ thắng ({multiWins}/{multiTotal} trận)</p>
              </div>
            </div>
          </div>

          {/* Filter options */}
          <div className="multi-filter-bar">
            <span className="filter-label">Lọc theo thể thức:</span>
            <div className="filter-buttons">
              <button
                type="button"
                className={`filter-btn ${multiFormatFilter === PlayFormat.UNSPECIFIED ? 'active' : ''}`}
                onClick={() => setMultiFormatFilter(PlayFormat.UNSPECIFIED)}
              >
                Tất cả
              </button>
              <button
                type="button"
                className={`filter-btn ${multiFormatFilter === PlayFormat.RACE ? 'active' : ''}`}
                onClick={() => setMultiFormatFilter(PlayFormat.RACE)}
              >
                ⚡ Đua tốc độ
              </button>
              <button
                type="button"
                className={`filter-btn ${multiFormatFilter === PlayFormat.DUEL ? 'active' : ''}`}
                onClick={() => setMultiFormatFilter(PlayFormat.DUEL)}
              >
                ⚔️ Đối kháng
              </button>
            </div>
          </div>

          {/* Multi items */}
          {loadingMulti && (
            <div className="history-loading">
              <div className="loader" />
              <p>Đang tải lịch sử Multiplayer…</p>
            </div>
          )}

          {multiError && (
            <div className="history-error">
              <p>{multiError}</p>
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => loadInitialMulti(multiFormatFilter)}
              >
                Thử lại
              </button>
            </div>
          )}

          {!loadingMulti && !multiError && multiItems.length === 0 && (
            <div className="history-empty">
              <span className="empty-icon">⚔️</span>
              <h3>Chưa có trận Multiplayer nào</h3>
              <p>Hãy tham gia sảnh chờ ghép trận để bắt đầu so tài với các cao thủ khác!</p>
            </div>
          )}

          {!loadingMulti && !multiError && multiItems.length > 0 && (
            <div className="history-list">
              {multiItems.map((item) => {
                const isWin = item.result === MatchResult.WIN
                const isLoss = item.result === MatchResult.LOSS
                return (
                  <article
                    key={item.matchId}
                    className={`history-row ${isWin ? 'win-row' : isLoss ? 'loss-row' : 'draw-row'}`}
                    onClick={() => setSelectedMatch({ type: 'multiplayer', id: item.matchId })}
                  >
                    <div className="row-badge-col">
                      <span
                        className={`status-pill ${
                          isWin ? 'pill-win' : isLoss ? 'pill-loss' : 'pill-draw'
                        }`}
                      >
                        {isWin ? 'Thắng' : isLoss ? 'Thất bại' : 'Hòa'}
                      </span>
                    </div>

                    <div className="row-info-col">
                      <div className="row-main-title">
                        <strong>
                          vs {item.opponentName || 'Đối thủ ẩn danh'}
                        </strong>
                        <span className="format-tag">
                          {item.playFormat === PlayFormat.DUEL ? 'Đối kháng' : 'Đua tốc độ'}
                        </span>
                      </div>
                      <span className="row-timestamp">{formatDateTime(item.completedAt)}</span>
                    </div>

                    <div className="row-metrics-col">
                      <div>
                        <span>Điểm</span>
                        <strong>{item.score} - {item.opponentScore}</strong>
                      </div>
                      <div>
                        <span>Biến động</span>
                        <strong className={`rating-delta ${item.ratingDelta >= 0 ? 'pos' : 'neg'}`}>
                          {item.ratingDelta > 0 ? `+${item.ratingDelta}` : item.ratingDelta}
                        </strong>
                      </div>
                      <div>
                        <span>Thời lượng</span>
                        <strong>{formatDurationSec(item.durationSeconds)}</strong>
                      </div>
                    </div>

                    <div className="row-action-col">
                      <button
                        type="button"
                        className="btn-view-detail"
                        aria-label="Xem chi tiết trận đấu"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedMatch({ type: 'multiplayer', id: item.matchId })
                        }}
                      >
                        Chi tiết →
                      </button>
                    </div>
                  </article>
                )
              })}

              {multiItems.length < multiTotal && (
                <div className="load-more-wrap">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={loadingMoreMulti}
                    onClick={handleLoadMoreMulti}
                  >
                    {loadingMoreMulti ? 'Đang tải thêm…' : `Xem thêm (${multiItems.length}/${multiTotal})`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Match Detail Modal with read-only board */}
      <MatchDetailModal
        open={Boolean(selectedMatch)}
        onClose={() => setSelectedMatch(null)}
        selectedItem={selectedMatch}
      />
    </section>
  )
}
