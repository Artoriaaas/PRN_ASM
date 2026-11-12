import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { UserProfile } from '../../gen/sudoku/user/v1/user_pb'
import { useAuth } from '../../auth/useAuth'
import { XpBar } from '../../components/XpBar'
import { Skeleton } from '../../components/ui/States'
import { MultiplayerRulesModal } from '../tutorial/MultiplayerRulesModal'
import type { RulesTab } from '../tutorial/MultiplayerRulesModal'

type HomePageProps = {
  profile: UserProfile | null
  loading: boolean
}

const QUICK_LINKS = [
  { to: '/leaderboard', icon: '🏆', label: 'Xếp hạng', badgeColor: 'gold' },
  { to: '/learn', icon: '📖', label: 'Học kỹ thuật', badgeColor: 'indigo' },
  { to: '/quests', icon: '✦', label: 'Nhiệm vụ', badgeColor: 'purple' },
  { to: '/notices', icon: '🔔', label: 'Thông báo', badgeColor: 'rose' },
]

export function HomePage({ profile, loading }: HomePageProps) {
  const { user } = useAuth()
  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Người chơi'
  const isProfileLoading = loading && !profile && !user?.displayName && !user?.email

  const [rulesOpen, setRulesOpen] = useState(false)
  const [rulesTab, setRulesTab] = useState<RulesTab>('race')

  function openRules(tab: RulesTab) {
    setRulesTab(tab)
    setRulesOpen(true)
  }

  return (
    <div className="home-page">
      {/* Hero chào */}
      <section className="home-hero">
        <div className="home-greet">
          <p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p>
          {isProfileLoading ? (
            <Skeleton height="2.8rem" width="240px" />
          ) : (
            <h1 className="home-name">{displayName}</h1>
          )}
        </div>

        {profile && (
          <div className="home-progress">
            <XpBar
              level={profile.playerLevel}
              xp={profile.totalExp}
              xpForNext={profile.playerLevel * 1000}
            />
            <div className="home-trophies">
              <span className="trophy-icon" aria-hidden="true">🏅</span>
              <span>{profile.trophies} Trophy</span>
            </div>
          </div>
        )}
      </section>

      {/* Hai lối vào chính */}
      <section className="home-play-modes" aria-label="Chế độ chơi">
        {/* Thẻ Solo */}
        <div className="play-mode-card play-solo">
          <div className="play-mode-bg" aria-hidden="true">
            <div className="pm-board-preview">
              {[5, 3, 0, 0, 7, 0, 0, 0, 0].map((v, i) => (
                <span key={i} className="pm-cell">{v || ''}</span>
              ))}
            </div>
          </div>
          <div className="play-mode-content">
            <div className="pm-header">
              <p className="pm-eyebrow">ĐỘC LẬP</p>
              <h2 className="pm-title">Solo</h2>
              <p className="pm-desc">
                Giải đố, cải thiện thời gian. Chọn độ khó và layout của riêng bạn.
              </p>
            </div>
            <div className="pm-actions">
              <Link to="/solo/new" className="card-action-btn solo-btn">
                Chơi ngay →
              </Link>
            </div>
          </div>
        </div>

        {/* Thẻ Multiplayer */}
        <div className="play-mode-card play-multi">
          <div className="play-mode-content">
            <div className="pm-header">
              <p className="pm-eyebrow">ĐẤU TRỰC TIẾP</p>
              <h2 className="pm-title">Multiplayer</h2>
              <p className="pm-desc">
                Race hoặc Duel với đối thủ cùng rating. Elo thay đổi thực.
              </p>
            </div>
            <div className="pm-actions">
              <Link to="/play" className="card-action-btn multi-btn">
                Vào sảnh →
              </Link>
              <div className="mp-rules-links">
                <button
                  type="button"
                  className="mp-rules-link"
                  onClick={() => openRules('race')}
                  aria-label="Xem luật Race"
                >
                  <span className="rules-icon" aria-hidden="true">⚡</span>
                  <span>Luật Race</span>
                </button>
                <button
                  type="button"
                  className="mp-rules-link"
                  onClick={() => openRules('duel')}
                  aria-label="Xem luật Duel"
                >
                  <span className="rules-icon" aria-hidden="true">♟️</span>
                  <span>Luật Duel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats nhanh (khi có profile) */}
      {profile && (
        <section className="home-stats" aria-label="Thống kê nhanh">
          <article className="home-stat">
            <strong>{profile.totalGames}</strong>
            <p>Ván đã chơi</p>
          </article>
          <article className="home-stat">
            <strong>{profile.wins}</strong>
            <p>Chiến thắng</p>
          </article>
          <article className="home-stat">
            <strong>{profile.totalExp}</strong>
            <p>Tổng XP</p>
          </article>
          <article className="home-stat">
            <strong>Cấp {profile.playerLevel}</strong>
            <p>Cấp độ</p>
          </article>
        </section>
      )}

      {/* Quick links (Hàng nút phụ) */}
      <nav className="home-quick-links" aria-label="Liên kết nhanh">
        {QUICK_LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="quick-link">
            <span className={`ql-icon ql-icon-${link.badgeColor}`} aria-hidden="true">
              {link.icon}
            </span>
            <span className="ql-label">{link.label}</span>
          </Link>
        ))}
      </nav>

      {/* Multiplayer Rules Modal */}
      <MultiplayerRulesModal
        open={rulesOpen}
        initialTab={rulesTab}
        onClose={() => setRulesOpen(false)}
      />
    </div>
  )
}
