import { type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { UserProfile } from '../gen/sudoku/user/v1/user_pb'
import { useAuth } from '../auth/useAuth'
import { clearCachedProfile } from '../api/userClient'

type AppShellProps = {
  profile: UserProfile | null
  children: ReactNode
}

const NAV_ITEMS = [
  { to: '/home', label: 'Trang chủ' },
  { to: '/play', label: 'Đấu trận' },
  { to: '/leaderboard', label: 'Xếp hạng' },
  { to: '/learn', label: 'Học' },
]

export function AppShell({ profile, children }: AppShellProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Ẩn nav khi trong trận
  const inGame =
    (location.pathname.startsWith('/solo/') ||
      location.pathname.startsWith('/match/')) &&
    !location.pathname.endsWith('/new') &&
    !location.pathname.endsWith('/result')

  async function handleLogout() {
    if (user) clearCachedProfile(user.uid)
    await logout()
    navigate('/')
  }

  if (inGame) {
    // Trong trận: không có nav, component tự quản lý topbar
    return <>{children}</>
  }

  const initials = (profile?.displayName || user?.displayName || user?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  return (
    <div className="app-shell">
      {/* Topbar desktop */}
      <header className="topbar">
        <Link to="/home" className="brand-link" aria-label="Sudoku Online — Trang chủ">
          <span className="brand-logo-sm" aria-hidden="true">9</span>
          <span className="brand-name-sm">Sudoku Online</span>
        </Link>

        <nav className="topbar-nav" aria-label="Điều hướng chính">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-link${location.pathname === item.to ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="topbar-right">
          <Link
            to="/notices"
            className="icon-btn"
            aria-label="Thông báo"
          >
            🔔
          </Link>
          <div className="avatar-menu">
            <Link to="/profile" className="topbar-avatar" aria-label="Hồ sơ của tôi">
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" />
              ) : (
                <span>{initials}</span>
              )}
            </Link>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav" aria-label="Điều hướng mobile">
        <Link to="/home" className={`bottom-nav-item${location.pathname === '/home' ? ' active' : ''}`}>
          <span aria-hidden="true">🏠</span>
          <span>Trang chủ</span>
        </Link>
        <Link to="/play" className={`bottom-nav-item${location.pathname === '/play' ? ' active' : ''}`}>
          <span aria-hidden="true">⚡</span>
          <span>Đấu</span>
        </Link>
        <Link to="/solo/new" className="bottom-nav-item solo-fab">
          <span aria-hidden="true">▶</span>
        </Link>
        <Link to="/leaderboard" className={`bottom-nav-item${location.pathname === '/leaderboard' ? ' active' : ''}`}>
          <span aria-hidden="true">🏆</span>
          <span>Xếp hạng</span>
        </Link>
        <Link to="/profile" className={`bottom-nav-item${location.pathname === '/profile' ? ' active' : ''}`}>
          <span aria-hidden="true">👤</span>
          <span>Hồ sơ</span>
        </Link>
      </nav>

      <main className="page-content">
        {children}
      </main>
    </div>
  )
}

