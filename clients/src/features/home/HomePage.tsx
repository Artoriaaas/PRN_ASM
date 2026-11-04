import { Link } from 'react-router-dom'
import type { UserProfile } from '../../gen/sudoku/user/v1/user_pb'
import { XpBar } from '../../components/XpBar'
import { Skeleton } from '../../components/ui/States'

type HomePageProps = {
  profile: UserProfile | null
  loading: boolean
}

const QUICK_LINKS = [
  { to: '/leaderboard', icon: '🏆', label: 'Xếp hạng' },
  { to: '/learn', icon: '📖', label: 'Học kỹ thuật' },
  { to: '/quests', icon: '✦', label: 'Nhiệm vụ' },
  { to: '/notices', icon: '🔔', label: 'Thông báo' },
]

export function HomePage({ profile, loading }: HomePageProps) {
  const displayName = profile?.displayName || 'Người chơi'

  return (
    <div className="home-page">
      {/* Hero chào */}
      <section className="home-hero">
        <div className="home-greet">
          <p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p>
          {loading && !profile ? (
            <Skeleton height="2.5rem" width="200px" />
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
        <Link to="/solo/new" className="play-mode-card play-solo">
          <div className="play-mode-bg" aria-hidden="true">
            <div className="pm-board-preview">
              {[5,3,0,0,7,0,0,0,0].map((v,i) => (
                <span key={i} className="pm-cell">{v || ''}</span>
              ))}
            </div>
          </div>
          <div className="play-mode-content">
            <p className="pm-eyebrow">ĐỘC LẬP</p>
            <h2>Solo</h2>
            <p>Giải đố, cải thiện thời gian. Chọn độ khó và layout của riêng bạn.</p>
            <span className="btn btn-white">Chơi ngay →</span>
          </div>
        </Link>

        <Link to="/play" className="play-mode-card play-multi">
          <div className="play-mode-content">
            <p className="pm-eyebrow">ĐẤU TRỰC TIẾP</p>
            <h2>Multiplayer</h2>
            <p>Race hoặc Duel với đối thủ cùng rating. Elo thay đổi thực.</p>
            <span className="btn btn-white">Vào sảnh →</span>
          </div>
        </Link>
      </section>

      {/* Stats nhanh */}
      {profile && (
        <section className="home-stats" aria-label="Thống kê nhanh">
          <article className="home-stat">
            <strong>{profile.totalGames}</strong>
            <p>Ván đã chơi</p>
          </article>
          <article className="home-stat">
            <strong>{profile.wins}</strong>
            <p>Thắng</p>
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

      {/* Quick links */}
      <nav className="home-quick-links" aria-label="Liên kết nhanh">
        {QUICK_LINKS.map((link) => (
          <Link key={link.to} to={link.to} className="quick-link">
            <span className="ql-icon" aria-hidden="true">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

