import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Layout = 'standard' | 'irregular'
type Level = 'easy' | 'medium' | 'hard' | 'expert'

const LAYOUTS: { value: Layout; label: string; desc: string; icon: string }[] = [
  { value: 'standard', label: 'Standard', desc: 'Khối 3×3 quen thuộc', icon: '▦' },
  { value: 'irregular', label: 'Shuffle / Irregular', desc: 'Vùng bất quy tắc, thử thách hơn', icon: '◈' },
]

const LEVELS: { value: Level; label: string; desc: string; color: string }[] = [
  { value: 'easy', label: 'Dễ', desc: '~5 phút', color: 'var(--success)' },
  { value: 'medium', label: 'Trung bình', desc: '~15 phút', color: 'var(--warning)' },
  { value: 'hard', label: 'Khó', desc: '~30 phút', color: 'var(--opponent)' },
  { value: 'expert', label: 'Chuyên gia', desc: 'Không giới hạn', color: 'var(--danger)' },
]

export function SoloSetupPage() {
  const navigate = useNavigate()
  const [layout, setLayout] = useState<Layout>('standard')
  const [level, setLevel] = useState<Level>('medium')
  const [logicOnly, setLogicOnly] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  async function handleStart() {
    if (isStarting) return
    setIsStarting(true)
    try {
      // TODO: gọi Game.StartGame khi proto có RPC nước đi
      // Tạm thời navigate với mock sessionId
      const mockSessionId = `mock-${Date.now()}`
      navigate(`/solo/${mockSessionId}`, {
        state: { layout, level, logicOnly },
      })
    } catch {
      setIsStarting(false)
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-inner">
        <div className="setup-header">
          <p className="eyebrow">SOLO</p>
          <h1>Thiết lập ván chơi</h1>
          <p className="setup-desc">Chọn layout và độ khó phù hợp với bạn.</p>
        </div>

        {/* Layout picker */}
        <section className="picker-section" aria-labelledby="layout-label">
          <h2 id="layout-label" className="picker-label">Layout bàn cờ</h2>
          <div className="picker-grid layout-picker">
            {LAYOUTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`picker-card${layout === opt.value ? ' selected' : ''}`}
                onClick={() => setLayout(opt.value)}
                aria-pressed={layout === opt.value}
              >
                <span className="picker-icon" aria-hidden="true">{opt.icon}</span>
                <strong>{opt.label}</strong>
                <p>{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Level picker */}
        <section className="picker-section" aria-labelledby="level-label">
          <h2 id="level-label" className="picker-label">Độ khó</h2>
          <div className="picker-grid level-picker">
            {LEVELS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`picker-card level-card${level === opt.value ? ' selected' : ''}`}
                style={{ '--level-color': opt.color } as React.CSSProperties}
                onClick={() => setLevel(opt.value)}
                aria-pressed={level === opt.value}
              >
                <strong className="level-label-text" style={{ color: opt.color }}>
                  {opt.label}
                </strong>
                <p>{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Logic only toggle */}
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={logicOnly}
            onChange={(e) => setLogicOnly(e.target.checked)}
          />
          <span className="toggle-label">
            <strong>Chỉ puzzle giải được bằng logic</strong>
            <span className="toggle-desc">Không cần đoán (đề xuất cho người học)</span>
          </span>
        </label>

        <button
          type="button"
          className="btn btn-primary btn-lg start-btn"
          onClick={handleStart}
          disabled={isStarting}
        >
          {isStarting ? 'Đang tạo ván…' : 'Bắt đầu chơi →'}
        </button>
      </div>
    </div>
  )
}

