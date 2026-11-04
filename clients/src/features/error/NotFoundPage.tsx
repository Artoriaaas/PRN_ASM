import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-inner">
        <div className="not-found-board" aria-hidden="true">
          <div className="nf-grid">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="nf-cell">{i === 4 ? '?' : ''}</span>
            ))}
          </div>
        </div>
        <p className="eyebrow">LỖI 404</p>
        <h1>Trang không tìm thấy</h1>
        <p className="nf-desc">
          Ô này trống rỗng. Trang bạn đang tìm không tồn tại hoặc đã bị di chuyển.
        </p>
        <div className="nf-actions">
          <Link to="/home" className="btn btn-primary">
            Về trang chủ
          </Link>
          <Link to="/" className="btn btn-ghost">
            Trang giới thiệu
          </Link>
        </div>
      </div>
    </div>
  )
}

