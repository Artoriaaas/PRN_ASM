import { useEffect, useState, type FormEvent } from 'react'
import { updateProfile as updateFirebaseProfile, type User } from 'firebase/auth'
import type { UserProfile } from '../../gen/sudoku/user/v1/user_pb'
import { useAuth } from '../../auth/useAuth'
import { getAuthErrorMessage } from '../../auth/firebaseErrors'
import { updateUserProfile } from '../../api/userClient'
import { MatchHistorySection } from './MatchHistorySection'

type ProfilePageProps = {
  user: User
  profile: UserProfile | null
  loading: boolean
  loadError: string
  view: 'profile' | 'settings'
  onNavigate: (path: '/profile' | '/settings') => void
  onRetry: () => void
  onUpdated: (profile: UserProfile) => void
}

export function ProfilePage({
  user,
  profile,
  loading,
  loadError,
  view,
  onNavigate,
  onRetry,
  onUpdated,
}: ProfilePageProps) {
  const { resendVerification } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [country, setCountry] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingVerification, setIsSendingVerification] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      // oxlint-disable-next-line react/set-state-in-effect -- Reset the editable draft when the server profile changes.
      setDisplayName(profile.displayName)
      setAvatarUrl(profile.avatarUrl)
      setCountry(profile.country)
    }
  }, [profile])
  // Làm mới hồ sơ mới nhất từ server khi mở trang
  useEffect(() => {
    onRetry()
  }, [onRetry])


  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!profile || isSubmitting) {
      return
    }

    setError('')
    setMessage('')
    setIsSubmitting(true)
    try {
      const nextProfile = await updateUserProfile(user.uid, {
        displayName,
        avatarUrl,
        country,
      })
      onUpdated(nextProfile)

      try {
        await updateFirebaseProfile(user, {
          displayName: nextProfile.displayName,
          photoURL: nextProfile.avatarUrl || null,
        })
        setMessage('Đã lưu thay đổi hồ sơ.')
      } catch {
        setMessage('Hồ sơ đã lưu; Firebase sẽ đồng bộ tên và ảnh ở lần đăng nhập sau.')
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Không thể lưu hồ sơ.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendVerification() {
    setError('')
    setMessage('')
    setIsSendingVerification(true)
    try {
      await resendVerification()
      setMessage('Đã gửi lại email xác minh.')
    } catch (verificationError) {
      setError(getAuthErrorMessage(verificationError))
    } finally {
      setIsSendingVerification(false)
    }
  }


  const initials = (profile?.displayName || user.displayName || user.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className="profile-page">
      <section className="profile-container">
        <div className="profile-tabs" role="tablist" aria-label="Tùy chọn tài khoản">
          <button
            role="tab"
            aria-selected={view === 'profile'}
            className={`profile-tab ${view === 'profile' ? 'active' : ''}`}
            type="button"
            onClick={() => onNavigate('/profile')}
          >
            Hồ sơ
          </button>
          <button
            role="tab"
            aria-selected={view === 'settings'}
            className={`profile-tab ${view === 'settings' ? 'active' : ''}`}
            type="button"
            onClick={() => onNavigate('/settings')}
          >
            Cài đặt
          </button>
        </div>
        {!user.emailVerified && (
          <div className="verification-banner">
            <div>
              <strong>Email chưa được xác minh</strong>
              <span> Xác minh để bảo vệ tài khoản và khôi phục mật khẩu dễ dàng hơn.</span>
            </div>
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={isSendingVerification}
            >
              {isSendingVerification ? 'Đang gửi…' : 'Gửi lại email'}
            </button>
          </div>
        )}

        {loadError && !profile && (
          <div className="load-state error-state" role="alert">
            <h2>Chưa tải được hồ sơ</h2>
            <p>{loadError}</p>
            <button className="primary-button compact" type="button" onClick={onRetry}>
              Thử lại
            </button>
          </div>
        )}

        {loading && !profile && (
          <div className="load-state" aria-live="polite">
            <div className="loader" />
            <p>Đang đồng bộ hồ sơ với User Service…</p>
          </div>
        )}

        {profile && (
          <>
            <section className="profile-hero">
              <div className="avatar-wrap">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={`Ảnh đại diện của ${profile.displayName}`} />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="profile-heading">
                <p className="eyebrow">HỒ SƠ NGƯỜI CHƠI</p>
                <h1>{profile.displayName}</h1>
                <p>{profile.email}</p>
                <div className="profile-meta">
                  <span>{profile.country || 'Chưa chọn quốc gia'}</span>
                  <span>Cấp {profile.playerLevel}</span>
                </div>
              </div>
              {view === 'profile' && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => onNavigate('/settings')}
                >
                  Chỉnh sửa hồ sơ
                </button>
              )}
            </section>

            {view === 'profile' ? (
              <section className="profile-content">
                <div className="stats-grid" aria-label="Thống kê người chơi">
                  <article>
                    <span className="stat-icon">◇</span>
                    <strong>{profile.totalGames}</strong>
                    <p>Ván đã chơi</p>
                  </article>
                  <article>
                    <span className="stat-icon">✓</span>
                    <strong>{profile.wins}</strong>
                    <p>Chiến thắng</p>
                  </article>
                  <article>
                    <span className="stat-icon">↗</span>
                    <strong>{profile.totalExp}</strong>
                    <p>Điểm kinh nghiệm</p>
                  </article>
                  <article>
                    <span className="stat-icon">♜</span>
                    <strong>{profile.trophies}</strong>
                    <p>Cúp thành tích</p>
                  </article>
                </div>

                <MatchHistorySection />

                <div className="profile-note">
                  <div>
                    <p className="eyebrow">TÀI KHOẢN</p>
                    <h2>Thông tin của bạn đã được bảo vệ</h2>
                    <p>
                      Firebase quản lý phiên đăng nhập; User Service chỉ lưu hồ sơ và
                      thành tích của bạn.
                    </p>
                  </div>
                  <span className="secure-badge">Firebase Auth</span>
                </div>
              </section>
            ) : (
              <section className="settings-card">
                <div className="settings-heading">
                  <p className="eyebrow">CÀI ĐẶT HỒ SƠ</p>
                  <h2>Thông tin cá nhân</h2>
                  <p>Email được lấy từ Firebase và không thể sửa tại đây.</p>
                </div>

                <form className="settings-form" onSubmit={handleSave}>
                  <label>
                    Tên hiển thị
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      maxLength={80}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input value={profile.email} readOnly disabled />
                  </label>
                  <label>
                    Quốc gia
                    <input
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      maxLength={80}
                      placeholder="Ví dụ: Việt Nam"
                    />
                  </label>
                  <label>
                    URL ảnh đại diện
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(event) => setAvatarUrl(event.target.value)}
                      maxLength={2048}
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </label>

                  {error && <p className="form-message error" role="alert">{error}</p>}
                  {message && <p className="form-message success" role="status">{message}</p>}

                  <div className="form-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => onNavigate('/profile')}
                    >
                      Hủy
                    </button>
                    <button className="primary-button compact" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Đang lưu…' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {(message || error) && view === 'profile' && (
              <p className={`floating-message ${error ? 'error' : 'success'}`}>
                {error || message}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
