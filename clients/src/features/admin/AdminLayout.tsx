import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import './admin.css'

export function AdminLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src="/logo.png" alt="Sudoku Logo" />
          <h2>SUDOKU ADMIN</h2>
        </div>

        <nav className="admin-nav">
          <NavLink
            to="/admin/users"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <span>👤</span>
            <span>Người dùng</span>
          </NavLink>

          <NavLink
            to="/admin/game-rules"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <span>⚙️</span>
            <span>Luật chơi</span>
          </NavLink>

          <NavLink
            to="/admin/feedback"
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <span>💬</span>
            <span>Feedback</span>
          </NavLink>
        </nav>

        <div className="admin-nav-footer">
          <button
            type="button"
            className="admin-logout-btn"
            onClick={handleLogout}
            title="Đăng xuất khỏi trang quản trị"
          >
            <span>🚪</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
