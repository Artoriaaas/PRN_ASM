/**
 * MultiplayerRulesModal — popup luật chơi cho Race và Duel.
 * Dùng tab để chuyển đổi giữa các mode.
 */
import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import {
  RACE_RULES,
  DUEL_RULES,
  type MultiplayerRulesSection,
} from './tutorialData'

export type RulesTab = 'race' | 'duel'

type MultiplayerRulesModalProps = {
  open: boolean
  initialTab?: RulesTab
  onClose: () => void
}

function RulesSectionList({ sections }: { sections: MultiplayerRulesSection[] }) {
  return (
    <div className="rules-sections">
      {sections.map((s) => (
        <div key={s.id} className={`rules-section${s.highlight ? ` ${s.highlight}` : ''}`}>
          <div className="rs-header">
            <span className="rs-icon" aria-hidden="true">{s.icon}</span>
            <h4 className="rs-title">{s.title}</h4>
          </div>
          <p className="rs-content">{s.content}</p>
        </div>
      ))}
    </div>
  )
}

export function MultiplayerRulesModal({
  open,
  initialTab = 'race',
  onClose,
}: MultiplayerRulesModalProps) {
  const [tab, setTab] = useState<RulesTab>(initialTab)

  // Sync tab khi modal mở lại với initialTab khác
  const resolvedTab = open ? tab : initialTab

  const tabs: { value: RulesTab; label: string; icon: string }[] = [
    { value: 'race', label: 'Race', icon: '⚡' },
    { value: 'duel', label: 'Duel', icon: '♟️' },
  ]

  return (
    <Modal
      open={open}
      title="Luật chơi Multiplayer"
      onClose={onClose}
      footer={
        <div className="modal-footer-btns">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Đã hiểu, chơi thôi!
          </button>
        </div>
      }
    >
      <div className="mp-rules-modal">
        {/* Tabs */}
        <div className="mp-tabs" role="tablist" aria-label="Chế độ chơi">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={resolvedTab === t.value}
              className={`mp-tab${resolvedTab === t.value ? ' active' : ''}`}
              onClick={() => setTab(t.value)}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mp-tab-content" role="tabpanel">
          {resolvedTab === 'race' && (
            <>
              <div className="rules-intro">
                <h3>⚡ Race — Đua tốc độ</h3>
                <p>
                  Hai người chơi giải <strong>cùng một bàn Sudoku</strong> cùng lúc.
                  Ai giải đúng và <strong>nhanh hơn</strong> thì thắng.
                </p>
              </div>
              <RulesSectionList sections={RACE_RULES} />
              <div className="rules-summary">
                <strong>Tóm tắt kết quả:</strong>
                <div className="rules-summary-grid">
                  <div className="rs-item win">🥇 Thắng: Hoàn thành đúng đầu tiên</div>
                  <div className="rs-item">⏱️ Thua: Chậm hơn hoặc hết giờ</div>
                  <div className="rs-item">❤️ Hết mạng: Thua ngay lập tức</div>
                  <div className="rs-item">⏰ +10s mỗi lần sai</div>
                </div>
              </div>
            </>
          )}

          {resolvedTab === 'duel' && (
            <>
              <div className="rules-intro">
                <h3>♟️ Duel — Đấu luân phiên</h3>
                <p>
                  Hai người dùng <strong>chung một bàn</strong>, thay nhau điền số.
                  Mỗi lượt <strong>15 giây</strong>. Ai nhiều điểm hơn khi bàn hoàn thành — thắng.
                </p>
              </div>
              <RulesSectionList sections={DUEL_RULES} />
              <div className="rules-summary">
                <strong>Bảng điểm Duel:</strong>
                <div className="rules-summary-grid">
                  <div className="rs-item win">✅ Điền đúng: +10 điểm</div>
                  <div className="rs-item">⚡ Điền nhanh: Bonus thêm</div>
                  <div className="rs-item danger">❌ Điền sai: -5 điểm, mất lượt, mất tim</div>
                  <div className="rs-item">⏰ Hết giờ lượt: Mất lượt (không phạt)</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

