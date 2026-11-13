import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { UserProfile } from '../../gen/sudoku/user/v1/user_pb'
import {
  PlayFormat,
  fetchRankings,
  resolveLevelFromElo,
  getCachedRatingsSync,
  fetchPlayerRatings,
} from '../../api/multiClient'
import { useAuth } from '../../auth/useAuth'
import {
  processRankings,
  type LeaderboardPlayerItem,
} from './mockLeaderboardData'
import './leaderboard.css'

interface LeaderboardPageProps {
  profile?: UserProfile | null
}

type TierFilterKey = 'all' | 'expert' | 'hard' | 'medium' | 'easy'

const TIER_FILTERS: { key: TierFilterKey; label: string }[] = [
  { key: 'all', label: 'Tất cả đoàn' },
  { key: 'expert', label: '👑 Cao thủ (1500+)' },
  { key: 'hard', label: '💎 Tinh anh (1300–1499)' },
  { key: 'medium', label: '⚔️ Kỳ thủ (1100–1299)' },
  { key: 'easy', label: '🛡️ Tân binh (<1100)' },
]

export function LeaderboardPage({ profile }: LeaderboardPageProps) {
  const { user } = useAuth()
  const [activeFormat, setActiveFormat] = useState<PlayFormat>(PlayFormat.RACE)
  const [tierFilter, setTierFilter] = useState<TierFilterKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [showInfoModal, setShowInfoModal] = useState(false)

  const [rawPlayers, setRawPlayers] = useState<LeaderboardPlayerItem[]>([])
  const [callerEntry, setCallerEntry] = useState<LeaderboardPlayerItem | undefined>()

  // Tải bảng xếp hạng từ backend hoặc fallback
  const loadLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const [rankingsRes, ratingsSummary] = await Promise.all([
        fetchRankings(activeFormat, 50),
        fetchPlayerRatings().catch(() => getCachedRatingsSync()),
      ])

      const isRace = activeFormat === PlayFormat.RACE
      const userElo = isRace ? ratingsSummary.race : ratingsSummary.duel
      const userPlayed = isRace ? ratingsSummary.racePlayed : ratingsSummary.duelPlayed
      const userWon = isRace ? ratingsSummary.raceWins : ratingsSummary.duelWins

      const displayName =
        profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Kỳ thủ'

      const processed = processRankings(
        rankingsRes.rankings,
        user?.uid,
        displayName,
        profile?.avatarUrl,
        userElo || 1000,
        userPlayed,
        userWon,
        activeFormat,
      )

      setRawPlayers(processed.list)
      setCallerEntry(processed.callerItem)
    } catch {
      // Fallback an toàn
      const summary = getCachedRatingsSync()
      const isRace = activeFormat === PlayFormat.RACE
      const displayName =
        profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Kỳ thủ'

      const processed = processRankings(
        [],
        user?.uid,
        displayName,
        profile?.avatarUrl,
        isRace ? summary.race : summary.duel,
        isRace ? summary.racePlayed : summary.duelPlayed,
        isRace ? summary.raceWins : summary.duelWins,
        activeFormat,
      )

      setRawPlayers(processed.list)
      setCallerEntry(processed.callerItem)
    } finally {
      setLoading(false)
    }
  }, [activeFormat, user, profile])

  useEffect(() => {
    void loadLeaderboard()
  }, [loadLeaderboard])

  // Lọc theo tìm kiếm và đoàn
  const filteredPlayers = useMemo(() => {
    let result = rawPlayers

    // Lọc theo đoàn
    if (tierFilter !== 'all') {
      result = result.filter((p) => {
        const tier = resolveLevelFromElo(p.rating)
        return tier.levelId === tierFilter
      })
    }

    // Lọc theo từ khóa tìm kiếm
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (p) =>
          p.playerName.toLowerCase().includes(q) ||
          String(p.rating).includes(q) ||
          String(p.rank).includes(q),
      )
    }

    return result
  }, [rawPlayers, tierFilter, searchQuery])

  // Top 3 người chơi đầu bảng cho bục vinh danh
  const top3 = useMemo(() => {
    return rawPlayers.slice(0, 3)
  }, [rawPlayers])

  const rank1 = top3[0]
  const rank2 = top3[1]
  const rank3 = top3[2]

  return (
    <div className="leaderboard-page">
      {/* ── Header ── */}
      <div className="leaderboard-header">
        <div className="leaderboard-title-group">
          <h1>
            <span className="leaderboard-title-badge" aria-hidden="true">
              🏆
            </span>
            Bảng xếp hạng Elo
          </h1>
          <p className="leaderboard-subtitle">
            Vinh danh những cao thủ Sudoku hàng đầu. Thi đấu Multiplayer để tích lũy Elo và khẳng
            định vị thế trên đấu trường trực tuyến.
          </p>
        </div>

        <button
          type="button"
          className="leaderboard-info-btn"
          onClick={() => setShowInfoModal(true)}
          title="Xem hệ thống đoàn và cách tính điểm Elo"
        >
          <span aria-hidden="true">ℹ️</span>
          <span>Bậc Rank & Luật Elo</span>
        </button>
      </div>

      {/* ── Thể thức thi đấu (Tabs) ── */}
      <div className="leaderboard-tabs-wrapper">
        <div className="leaderboard-format-tabs" role="tablist" aria-label="Thể thức thi đấu">
          <button
            type="button"
            role="tab"
            aria-selected={activeFormat === PlayFormat.RACE}
            className={`leaderboard-tab-btn ${activeFormat === PlayFormat.RACE ? 'active' : ''}`}
            onClick={() => setActiveFormat(PlayFormat.RACE)}
          >
            <span aria-hidden="true">🏎️</span>
            <span>Đua tốc độ (Race)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeFormat === PlayFormat.DUEL}
            className={`leaderboard-tab-btn ${activeFormat === PlayFormat.DUEL ? 'active' : ''}`}
            onClick={() => setActiveFormat(PlayFormat.DUEL)}
          >
            <span aria-hidden="true">⚔️</span>
            <span>Đối kháng lượt (Duel)</span>
          </button>
        </div>
        <p className="leaderboard-format-desc">
          {activeFormat === PlayFormat.RACE
            ? '⚡ Giải bảng số độc lập song song. Người hoàn thành chuẩn xác và nhanh nhất giành trọn vẹn điểm Elo.'
            : '🎯 Đấu trí trên cùng một bàn cờ 9x9. Thay phiên đi nước, tính điểm combo và chặn nước đối thủ.'}
        </p>
      </div>

      {/* ── Bục vinh danh Top 3 (Podium) ── */}
      {!loading && top3.length > 0 && !searchQuery && tierFilter === 'all' && (
        <div
          className="leaderboard-podium"
          style={
            top3.length === 1
              ? { gridTemplateColumns: '1fr', maxWidth: '320px', margin: '36px auto 32px' }
              : top3.length === 2
              ? { gridTemplateColumns: '1fr 1.15fr', maxWidth: '540px', margin: '36px auto 32px' }
              : undefined
          }
          aria-label="Top kỳ thủ xuất sắc nhất"
        >
          {/* Hạng 2 (Bạc) */}
          {rank2 && (
            <div className="podium-card rank-2">
              <div className="podium-avatar-box">
                {rank2.avatarUrl ? (
                  <img src={rank2.avatarUrl} alt="" />
                ) : (
                  <span>{rank2.playerName.charAt(0)}</span>
                )}
                <div className="podium-rank-badge">2</div>
              </div>
              <h3 className="podium-name" title={rank2.playerName}>
                {rank2.playerName}
              </h3>
              <div className="podium-elo">{rank2.rating} Elo</div>
              <div className="podium-base">
                <span className="podium-base-rank">2</span>
                <span className="podium-base-stat">Thắng {rank2.winRate}%</span>
              </div>
            </div>
          )}

          {/* Hạng 1 (Vàng - Quán quân) */}
          {rank1 && (
            <div className="podium-card rank-1">
              <span className="podium-crown" aria-hidden="true">
                👑
              </span>
              <div className="podium-avatar-box">
                {rank1.avatarUrl ? (
                  <img src={rank1.avatarUrl} alt="" />
                ) : (
                  <span>{rank1.playerName.charAt(0)}</span>
                )}
                <div className="podium-rank-badge">1</div>
              </div>
              <h3 className="podium-name" title={rank1.playerName}>
                {rank1.playerName}
              </h3>
              <div className="podium-elo">{rank1.rating} Elo</div>
              <div className="podium-base">
                <span className="podium-base-rank">1</span>
                <span className="podium-base-stat">Quán quân • {rank1.winRate}%</span>
              </div>
            </div>
          )}

          {/* Hạng 3 (Đồng) */}
          {rank3 && (
            <div className="podium-card rank-3">
              <div className="podium-avatar-box">
                {rank3.avatarUrl ? (
                  <img src={rank3.avatarUrl} alt="" />
                ) : (
                  <span>{rank3.playerName.charAt(0)}</span>
                )}
                <div className="podium-rank-badge">3</div>
              </div>
              <h3 className="podium-name" title={rank3.playerName}>
                {rank3.playerName}
              </h3>
              <div className="podium-elo">{rank3.rating} Elo</div>
              <div className="podium-base">
                <span className="podium-base-rank">3</span>
                <span className="podium-base-stat">Thắng {rank3.winRate}%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bộ điều khiển: Tìm kiếm & Lọc Đoàn ── */}
      <div className="leaderboard-controls">
        <div className="leaderboard-search-box">
          <span className="leaderboard-search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            type="text"
            className="leaderboard-search-input"
            placeholder="Tìm theo tên kỳ thủ hoặc Elo…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Tìm kiếm kỳ thủ"
          />
          {searchQuery && (
            <button
              type="button"
              className="leaderboard-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        <div className="leaderboard-tier-chips" role="group" aria-label="Lọc theo bậc rank">
          {TIER_FILTERS.map((tf) => (
            <button
              key={tf.key}
              type="button"
              className={`tier-chip ${tierFilter === tf.key ? 'active' : ''}`}
              onClick={() => setTierFilter(tf.key)}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bảng xếp hạng chi tiết ── */}
      <div className="leaderboard-table-card">
        {loading ? (
          <div style={{ padding: '24px 0' }}>
            {[1, 2, 3, 4, 5, 6].map((k) => (
              <div key={k} className="leaderboard-skeleton-row" />
            ))}
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="leaderboard-empty">
            <div className="leaderboard-empty-icon" aria-hidden="true">
              🍃
            </div>
            <h3>
              {searchQuery || tierFilter !== 'all'
                ? 'Không tìm thấy kỳ thủ phù hợp'
                : 'Chưa có kỳ thủ nào trên bảng xếp hạng'}
            </h3>
            <p>
              {searchQuery || tierFilter !== 'all'
                ? 'Hãy thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc đoàn khác.'
                : 'Hãy là người đầu tiên tham gia đấu trận Multiplayer để ghi danh trên bảng vàng!'}
            </p>
            {!searchQuery && tierFilter === 'all' && (
              <Link
                to="/play"
                className="btn btn-primary"
                style={{
                  marginTop: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 20px',
                  borderRadius: '10px',
                }}
              >
                <span>Tham gia đấu trận ngay</span>
                <span aria-hidden="true">⚔️</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="leaderboard-table-responsive">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="col-rank">Hạng</th>
                  <th className="col-player">Kỳ thủ</th>
                  <th>Danh hiệu / Đoàn</th>
                  <th className="col-elo">Điểm Elo</th>
                  <th className="col-matches">Số trận (Thắng)</th>
                  <th className="col-winrate">Tỷ lệ thắng</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => {
                  const tier = resolveLevelFromElo(player.rating)
                  const isTop1 = player.rank === 1
                  const isTop2 = player.rank === 2
                  const isTop3 = player.rank === 3

                  return (
                    <tr
                      key={player.userId}
                      className={`leaderboard-row ${player.isCurrentUser ? 'is-me' : ''}`}
                    >
                      {/* Cột Hạng */}
                      <td className="col-rank">
                        {isTop1 ? (
                          <span className="rank-top-badge gold" title="Hạng 1 Quán quân">
                            🥇
                          </span>
                        ) : isTop2 ? (
                          <span className="rank-top-badge silver" title="Hạng 2 Á quân">
                            🥈
                          </span>
                        ) : isTop3 ? (
                          <span className="rank-top-badge bronze" title="Hạng 3 Quý quân">
                            🥉
                          </span>
                        ) : (
                          <span className="rank-number">#{player.rank}</span>
                        )}
                      </td>

                      {/* Cột Kỳ thủ */}
                      <td className="col-player">
                        <div className="player-info-cell">
                          <div className="player-avatar" aria-hidden="true">
                            {player.avatarUrl ? (
                              <img src={player.avatarUrl} alt="" />
                            ) : (
                              <span>{player.playerName.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="player-names">
                            <span className="player-display-name">{player.playerName}</span>
                            {player.isCurrentUser && (
                              <span className="badge-you" title="Tài khoản của bạn">
                                Bạn
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cột Đoàn / Danh hiệu */}
                      <td>
                        <span className={`tier-tag ${tier.levelId}`}>
                          {tier.levelId === 'expert' && '👑 '}
                          {tier.levelId === 'hard' && '💎 '}
                          {tier.levelId === 'medium' && '⚔️ '}
                          {tier.levelId === 'easy' && '🛡️ '}
                          {tier.rankTitle}
                        </span>
                      </td>

                      {/* Cột Điểm Elo */}
                      <td className="col-elo">
                        <span>{player.rating}</span>
                      </td>

                      {/* Cột Số trận */}
                      <td className="col-matches">
                        <span>{player.matchesPlayed} ván</span>{' '}
                        <span className="matches-won-highlight">({player.matchesWon} thắng)</span>
                      </td>

                      {/* Cột Winrate */}
                      <td className="col-winrate">
                        <div className="winrate-box">
                          <div className="winrate-bar-track">
                            <div
                              className="winrate-bar-fill"
                              style={{ width: `${Math.min(100, player.winRate)}%` }}
                            />
                          </div>
                          <span className="winrate-text">{player.winRate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Thanh Sticky "Vị trí của bạn" ── */}
      {callerEntry && (
        <aside className="leaderboard-sticky-user" aria-label="Thứ hạng của bạn">
          <div className="sticky-user-left">
            <div className="sticky-user-rank">#{callerEntry.rank}</div>
            <div className="sticky-user-info">
              <div className="sticky-user-name">
                {callerEntry.playerName} •{' '}
                <span style={{ color: '#FBBF24' }}>{callerEntry.rating} Elo</span>
              </div>
              <div className="sticky-user-meta">
                <span>
                  Đoàn: <strong>{resolveLevelFromElo(callerEntry.rating).rankTitle}</strong>
                </span>
                <span>•</span>
                <span>
                  Đã đấu: <strong>{callerEntry.matchesPlayed}</strong> ván
                </span>
                <span>•</span>
                <span>
                  Tỷ lệ thắng: <strong>{callerEntry.winRate}%</strong>
                </span>
              </div>
            </div>
          </div>

          <Link to="/play" className="sticky-user-btn">
            <span>Đấu trận ngay</span>
            <span aria-hidden="true">⚔️</span>
          </Link>
        </aside>
      )}

      {/* ── Modal Bậc Rank & Luật Elo ── */}
      {showInfoModal && (
        <div
          className="rank-info-modal-backdrop"
          onClick={() => setShowInfoModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-rank-title"
        >
          <div className="rank-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rank-modal-header">
              <h3 id="modal-rank-title">Hệ thống Rank & Điểm Elo</h3>
              <button
                type="button"
                className="rank-modal-close-btn"
                onClick={() => setShowInfoModal(false)}
                aria-label="Đóng cửa sổ"
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Điểm số Elo phản ánh trình độ thi đấu thực tế của bạn trong các ván đấu Multiplayer.
              Sau mỗi trận, điểm Elo sẽ tăng hoặc giảm dựa trên kết quả và khoảng cách Elo với đối thủ.
            </p>

            <div className="rank-tiers-grid">
              <div className="rank-tier-row">
                <span className="rank-tier-name" style={{ color: '#DC2626' }}>
                  👑 Cao thủ (Expert)
                </span>
                <span className="rank-tier-range">≥ 1500 Elo</span>
              </div>
              <div className="rank-tier-row">
                <span className="rank-tier-name" style={{ color: '#EA580C' }}>
                  💎 Tinh anh (Hard)
                </span>
                <span className="rank-tier-range">1300 – 1499 Elo</span>
              </div>
              <div className="rank-tier-row">
                <span className="rank-tier-name" style={{ color: '#D97706' }}>
                  ⚔️ Kỳ thủ (Medium)
                </span>
                <span className="rank-tier-range">1100 – 1299 Elo</span>
              </div>
              <div className="rank-tier-row">
                <span className="rank-tier-name" style={{ color: '#15803D' }}>
                  🛡️ Tân binh (Easy)
                </span>
                <span className="rank-tier-range">&lt; 1100 Elo</span>
              </div>
            </div>

            <div className="rank-formula-note">
              <strong>💡 Cơ chế tính điểm:</strong> Thắng đối thủ có Elo cao hơn sẽ nhận được nhiều
              điểm hơn; ngược lại thất bại trước đối thủ có Elo thấp hơn sẽ bị trừ nhiều điểm hơn.
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '8px 18px', borderRadius: '10px' }}
                onClick={() => setShowInfoModal(false)}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

