import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getAuthErrorMessage } from '../../auth/firebaseErrors'

type AuthMode = 'login' | 'register'

export function AuthPage() {
  const { login, register, loginWithGoogle, resetPassword } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (mode === 'register' && password !== confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'register') {
        await register(displayName, email, password)
      } else {
        await login(email, password)
      }
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setNotice('')
    setIsSubmitting(true)
    try {
      await loginWithGoogle()
    } catch (loginError) {
      setError(getAuthErrorMessage(loginError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePasswordReset() {
    setError('')
    setNotice('')
    if (!email.trim()) {
      setError('Nhập email trước khi yêu cầu đặt lại mật khẩu.')
      return
    }

    setIsSubmitting(true)
    try {
      await resetPassword(email)
      setNotice('Đã gửi email đặt lại mật khẩu. Hãy kiểm tra hộp thư của bạn.')
    } catch (resetError) {
      setError(getAuthErrorMessage(resetError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-intro" aria-labelledby="auth-heading">
        <div className="brand-mark" aria-hidden="true">
          9
        </div>
        <p className="eyebrow">SUDOKU ONLINE</p>
        <h1 id="auth-heading">Một nơi yên tĩnh để rèn luyện tư duy.</h1>
        <p className="auth-lead">
          Đăng nhập để lưu tiến độ, theo dõi thành tích và tiếp tục ván chơi trên
          mọi thiết bị.
        </p>
        <div className="mini-board" aria-hidden="true">
          {['8', '', '6', '', '9', '', '4', '', '2'].map((value, index) => (
            <span key={`${value}-${index}`}>{value}</span>
          ))}
        </div>
      </section>

      <section className="auth-panel" aria-label="Tài khoản">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Chọn thao tác">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => selectMode('login')}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'active' : ''}
              onClick={() => selectMode('register')}
            >
              Tạo tài khoản
            </button>
          </div>

          <div className="auth-card-heading">
            <p className="eyebrow">CHÀO MỪNG BẠN</p>
            <h2>{mode === 'login' ? 'Tiếp tục hành trình' : 'Tạo hồ sơ người chơi'}</h2>
            <p>
              {mode === 'login'
                ? 'Nhập thông tin tài khoản Firebase của bạn.'
                : 'Chỉ mất một phút để bắt đầu.'}
            </p>
          </div>

          <button
            className="google-button"
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
          >
            <span aria-hidden="true">G</span>
            Tiếp tục với Google
          </button>

          <div className="divider"><span>hoặc dùng email</span></div>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <label>
                Tên hiển thị
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  required
                  placeholder="Ví dụ: Minh Anh"
                />
              </label>
            )}

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                placeholder="ban@example.com"
              />
            </label>

            <label>
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
                placeholder="Tối thiểu 6 ký tự"
              />
            </label>

            {mode === 'register' && (
              <label>
                Xác nhận mật khẩu
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  required
                  placeholder="Nhập lại mật khẩu"
                />
              </label>
            )}

            {error && <p className="form-message error" role="alert">{error}</p>}
            {notice && <p className="form-message success" role="status">{notice}</p>}

            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Đang xử lý…'
                : mode === 'login'
                  ? 'Đăng nhập'
                  : 'Tạo tài khoản'}
            </button>
          </form>

          {mode === 'login' && (
            <button
              className="text-button forgot-button"
              type="button"
              onClick={handlePasswordReset}
              disabled={isSubmitting}
            >
              Quên mật khẩu?
            </button>
          )}
          <div className="auth-guest-divider">
            <Link to="/solo/new" className="text-button guest-play-link">
              🎮 Chơi thử Solo ngay (Không cần đăng nhập)
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
