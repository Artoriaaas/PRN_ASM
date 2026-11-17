import { Link } from 'react-router-dom'

const FEATURES = [
  {
    icon: '◈',
    title: 'Standard & Shuffle',
    desc: 'Chơi bàn cổ điển 3×3 hoặc khám phá layout không đều với vùng bất quy tắc.',
  },
  {
    icon: '⚡',
    title: 'Race 1v1',
    desc: 'Đua với đối thủ cùng rating. Ai điền đúng nhanh hơn thắng. Mỗi sai lầm cộng 10 giây.',
  },
  {
    icon: '♟',
    title: 'Duel — đấu luân phiên',
    desc: 'Mỗi lượt 15 giây. Điền đúng ghi điểm, điền sai mất lượt và -5 điểm.',
  },
  {
    icon: '📈',
    title: 'XP & Elo',
    desc: 'Mỗi ván solo tích lũy XP và tăng cấp. Mỗi trận đấu thay đổi Elo theo format.',
  },
]

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="brand">
          <span className="brand-logo" aria-hidden="true">9</span>
          <span className="brand-name">Sudoku Online</span>
        </div>
        <Link to="/auth" className="btn btn-primary">
          Đăng nhập
        </Link>
      </header>

      <main>
        {/* Hero */}
        <section className="landing-hero">
          <div className="hero-content">
            <p className="eyebrow">SUDOKU ONLINE PLATFORM</p>
            <h1 className="hero-title">
              Rèn tư duy.<br />
              Thách thức giới hạn.
            </h1>
            <p className="hero-lead">
              Chơi Sudoku một mình hoặc đấu trực tiếp cùng người chơi khác trên toàn cầu.
              Hai layout, hai chế độ đấu, một bảng xếp hạng thực sự.
            </p>
            <div className="hero-actions">
              <Link to="/solo/new" className="btn btn-primary btn-lg">
                Chơi ngay (Solo)
              </Link>
              <Link to="/auth" className="btn btn-ghost btn-lg">
                Đăng nhập tài khoản
              </Link>
              <a href="#features" className="btn btn-ghost btn-lg">
                Tìm hiểu thêm
              </a>
            </div>
          </div>

          {/* Mini board minh họa */}
          <div className="hero-board" aria-hidden="true">
            <div className="demo-grid">
              {[
                5,3,0, 0,7,0, 0,0,0,
                6,0,0, 1,9,5, 0,0,0,
                0,9,8, 0,0,0, 0,6,0,
                8,0,0, 0,6,0, 0,0,3,
                4,0,0, 8,0,3, 0,0,1,
                7,0,0, 0,2,0, 0,0,6,
                0,6,0, 0,0,0, 2,8,0,
                0,0,0, 4,1,9, 0,0,5,
                0,0,0, 0,8,0, 0,7,9,
              ].map((v, i) => (
                <span
                  key={i}
                  className={`demo-cell${v === 0 ? ' empty' : ''}${[13,22,40].includes(i) ? ' highlight' : ''}`}
                >
                  {v !== 0 ? v : ''}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="landing-features" id="features">
          <div className="section-inner">
            <p className="eyebrow">TÍNH NĂNG</p>
            <h2 className="section-title">Mọi thứ bạn cần để chơi nghiêm túc</h2>
            <div className="features-grid">
              {FEATURES.map((f) => (
                <article key={f.title} className="feature-card">
                  <span className="feature-icon" aria-hidden="true">{f.icon}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="landing-cta">
          <div className="section-inner cta-inner">
            <h2>Sẵn sàng chưa?</h2>
            <p>Tạo tài khoản miễn phí và bắt đầu ván đầu tiên ngay hôm nay.</p>
            <Link to="/auth" className="btn btn-primary btn-lg">
              Tạo tài khoản
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>© 2026 Sudoku Online · PRN_ASM Project</p>
      </footer>
    </div>
  )
}

