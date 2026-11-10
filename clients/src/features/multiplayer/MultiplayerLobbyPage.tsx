import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserProfile } from '../../gen/sudoku/user/v1/user_pb'
import {
  PlayFormat,
  BoardLayoutType,
  getCachedRatingsSync,
  fetchPlayerRatings,
  resolveLevelFromElo,
  type PlayerRatingsSummary,
} from '../../api/multiClient'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'

type MultiplayerLobbyPageProps = {
  profile: UserProfile | null
}

type CustomRoomTab = 'create' | 'join'
type CustomLevel = 'easy' | 'medium' | 'hard' | 'expert'

const CUSTOM_LEVELS: { value: CustomLevel; label: string; desc: string; color: string }[] = [
  { value: 'easy', label: 'Dễ', desc: '38–42 ô cho sẵn', color: 'var(--success)' },
  { value: 'medium', label: 'Trung bình', desc: '32–36 ô cho sẵn', color: 'var(--warning)' },
  { value: 'hard', label: 'Khó', desc: '28–31 ô cho sẵn', color: 'var(--opponent)' },
  { value: 'expert', label: 'Chuyên gia', desc: '24–27 ô cho sẵn', color: 'var(--danger)' },
]

export function MultiplayerLobbyPage({ profile }: MultiplayerLobbyPageProps) {
  const navigate = useNavigate()
  const showToast = useToast()

  const [ratings, setRatings] = useState<PlayerRatingsSummary>(() => getCachedRatingsSync())
  const [boardLayout, setBoardLayout] = useState<BoardLayoutType>(BoardLayoutType.STANDARD)

  // Custom Room Modal state
  const [customModalOpen, setCustomModalOpen] = useState(false)
  const [customTab, setCustomTab] = useState<CustomRoomTab>('create')
  const [customFormat, setCustomFormat] = useState<PlayFormat>(PlayFormat.RACE)
  const [customLayout, setCustomLayout] = useState<BoardLayoutType>(BoardLayoutType.STANDARD)
  const [customLevel, setCustomLevel] = useState<CustomLevel>('medium')
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchPlayerRatings(controller.signal).then((fresh) => {
      if (!controller.signal.aborted) {
        setRatings(fresh)
      }
    })
    return () => controller.abort()
  }, [])

  const raceDifficulty = resolveLevelFromElo(ratings.race)
  const duelDifficulty = resolveLevelFromElo(ratings.duel)
  const layoutParam = boardLayout === BoardLayoutType.IRREGULAR ? 'irregular' : 'standard'

  function handleSelectRace() {
    navigate(`/play/queue?mode=race&layout=${layoutParam}`)
  }

  function handleSelectDuel() {
    navigate(`/play/queue?mode=duel&layout=${layoutParam}`)
  }

  function handleSelectTournament() {
    navigate('/tournaments')
  }

  function handleOpenCustomRoom(defaultTab: CustomRoomTab = 'create') {
    setCustomTab(defaultTab)
    setCustomModalOpen(true)
  }

  function handleCreateCustomRoom() {
    if (isSubmittingCustom) return
    setIsSubmittingCustom(true)
    const modeStr = customFormat === PlayFormat.DUEL ? 'duel' : 'race'
    const layoutStr = customLayout === BoardLayoutType.IRREGULAR ? 'irregular' : 'standard'
    setCustomModalOpen(false)
    setIsSubmittingCustom(false)
    navigate(
      `/play/queue?mode=${modeStr}&layout=${layoutStr}&level=${customLevel}&room=create`,
    )
  }

  function handleJoinCustomRoom(e: React.FormEvent) {
    e.preventDefault()
    const cleanCode = joinCodeInput.trim().toUpperCase()
    if (cleanCode.length !== 6) {
      showToast('Vui lòng nhập mã phòng gồm đúng 6 ký tự.', 'error')
      return
    }
    setCustomModalOpen(false)
    navigate(`/play/queue?room=join&code=${encodeURIComponent(cleanCode)}`)
  }

  const displayName = profile?.displayName || 'Người chơi'

  return (
    <div className="multi-lobby-page">
      {/* Header sảnh Multiplayer */}
      <header className="multi-lobby-header">
        <div className="multi-lobby-title-group">
          <p className="eyebrow">ĐẤU TRƯỜNG TRỰC TUYẾN 1V1</p>
          <h1>Sảnh Multiplayer</h1>
          <p className="multi-lobby-subtitle">
            Chọn một trong 4 chế độ bên dưới. Với <strong>Race</strong> và{' '}
            <strong>Duel</strong>, độ khó bàn cờ được tự động cân bằng theo điểm{' '}
            <strong>Elo</strong> của bạn.
          </p>
        </div>

        {/* Bộ chọn nhanh Bố cục bàn cờ (Standard / Irregular) */}
        <div className="multi-layout-bar" role="group" aria-label="Bố cục bàn cờ khi tìm trận">
          <span className="multi-layout-label">Bố cục bàn cờ:</span>
          <div className="multi-layout-pills">
            <button
              type="button"
              className={`multi-layout-pill ${boardLayout === BoardLayoutType.STANDARD ? 'active' : ''}`}
              onClick={() => setBoardLayout(BoardLayoutType.STANDARD)}
              aria-pressed={boardLayout === BoardLayoutType.STANDARD}
            >
              <span aria-hidden="true">▦</span> Standard 3×3
            </button>
            <button
              type="button"
              className={`multi-layout-pill ${boardLayout === BoardLayoutType.IRREGULAR ? 'active' : ''}`}
              onClick={() => setBoardLayout(BoardLayoutType.IRREGULAR)}
              aria-pressed={boardLayout === BoardLayoutType.IRREGULAR}
            >
              <span aria-hidden="true">◈</span> Irregular
            </button>
          </div>
        </div>
      </header>

      {/* 4 Nút lớn: Race, Duel, Tournament, Custom Room */}
      <section className="multi-four-modes" aria-label="4 chế độ phòng Multiplayer">
        {/* 1. RACE */}
        <button
          type="button"
          className="multi-mode-btn mode-race"
          onClick={handleSelectRace}
        >
          <div className="multi-mode-top">
            <span className="multi-mode-icon" aria-hidden="true">⚡</span>
            <span className="multi-mode-elo-badge">
              {ratings.race} ELO
            </span>
          </div>
          <div className="multi-mode-body">
            <h2>Race</h2>
            <p className="multi-mode-tagline">Đua tốc độ 2 bàn cờ độc lập</p>
            <p className="multi-mode-desc">
              Cùng giải một đề Sudoku với đối thủ theo thời gian thực. Điền sai mất 1
              mạng và cộng 10 giây phạt. Ai hoàn thành trước sẽ chiến thắng!
            </p>
          </div>
          <div className="multi-mode-footer">
            <span
              className="multi-difficulty-chip"
              style={{ borderColor: raceDifficulty.color, color: raceDifficulty.color }}
            >
              Độ khó Elo: {raceDifficulty.label}
            </span>
            <span className="multi-mode-cta">Tìm trận ngay →</span>
          </div>
        </button>

        {/* 2. DUEL */}
        <button
          type="button"
          className="multi-mode-btn mode-duel"
          onClick={handleSelectDuel}
        >
          <div className="multi-mode-top">
            <span className="multi-mode-icon" aria-hidden="true">⚔️</span>
            <span className="multi-mode-elo-badge duel">
              {ratings.duel} ELO
            </span>
          </div>
          <div className="multi-mode-body">
            <h2>Duel</h2>
            <p className="multi-mode-tagline">Đấu trí luân phiên trên 1 bàn cờ chung</p>
            <p className="multi-mode-desc">
              Hai người chơi dùng chung bàn cờ, mỗi lượt 15 giây. Ghi điểm theo độ khó
              nước đi (+5, +10, +8×ứng viên). Điền sai trừ 5 điểm, mất lượt và lộ số!
            </p>
          </div>
          <div className="multi-mode-footer">
            <span
              className="multi-difficulty-chip"
              style={{ borderColor: duelDifficulty.color, color: duelDifficulty.color }}
            >
              Độ khó Elo: {duelDifficulty.label}
            </span>
            <span className="multi-mode-cta">Tìm trận ngay →</span>
          </div>
        </button>

        {/* 3. TOURNAMENT */}
        <button
          type="button"
          className="multi-mode-btn mode-tournament"
          onClick={handleSelectTournament}
        >
          <div className="multi-mode-top">
            <span className="multi-mode-icon" aria-hidden="true">🏆</span>
            <span className="multi-mode-tag-pill">4 / 8 / 16 NGƯỜI</span>
          </div>
          <div className="multi-mode-body">
            <h2>Tournament</h2>
            <p className="multi-mode-tagline">Giải đấu loại trực tiếp theo nhánh</p>
            <p className="multi-mode-desc">
              Tham gia các giải đấu định kỳ hoặc tạo giải đấu mới theo thể thức nhánh
              đấu (Tứ kết, Bán kết, Chung kết) để tranh cúp vô địch.
            </p>
          </div>
          <div className="multi-mode-footer">
            <span className="multi-difficulty-chip neutral">
              Nhánh đấu Bracket
            </span>
            <span className="multi-mode-cta">Vào giải đấu →</span>
          </div>
        </button>

        {/* 4. CUSTOM ROOM */}
        <button
          type="button"
          className="multi-mode-btn mode-custom"
          onClick={() => handleOpenCustomRoom('create')}
        >
          <div className="multi-mode-top">
            <span className="multi-mode-icon" aria-hidden="true">🔑</span>
            <span className="multi-mode-tag-pill custom">MÃ 6 KÝ TỰ</span>
          </div>
          <div className="multi-mode-body">
            <h2>Custom Room</h2>
            <p className="multi-mode-tagline">Tạo phòng riêng hoặc nhập mã mời</p>
            <p className="multi-mode-desc">
              Tự chọn chế độ chơi (Race hoặc Duel), bố cục và độ khó tùy ý. Chia sẻ mã
              phòng 6 ký tự để so tài trực tiếp cùng bạn bè.
            </p>
          </div>
          <div className="multi-mode-footer">
            <span className="multi-difficulty-chip neutral">
              Tạo phòng / Nhập mã
            </span>
            <span className="multi-mode-cta">Mở phòng →</span>
          </div>
        </button>
      </section>

      {/* Thanh thông tin người chơi & Lối tắt */}
      <section className="multi-lobby-bottom" aria-label="Thông tin kỳ thủ">
        <div className="multi-player-strip">
          <div className="multi-player-avatar">
            {displayName[0]?.toUpperCase() || 'U'}
          </div>
          <div className="multi-player-meta">
            <strong>{displayName}</strong>
            <span>
              Race: <b>{ratings.race} Elo</b> ({raceDifficulty.rankTitle}) · Duel:{' '}
              <b>{ratings.duel} Elo</b> ({duelDifficulty.rankTitle})
            </span>
          </div>
        </div>

        <div className="multi-lobby-links">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => handleOpenCustomRoom('join')}
          >
            🔢 Nhập mã phòng nhanh
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/leaderboard')}
          >
            🏆 Bảng xếp hạng
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/history')}
          >
            📜 Lịch sử đấu
          </button>
        </div>
      </section>

      {/* Modal Custom Room: Tạo phòng hoặc Nhập mã phòng 6 ký tự */}
      <Modal
        open={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        title="Custom Room — Phòng Tùy Chỉnh"
      >
        <div className="custom-room-modal">
          <div className="custom-room-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={customTab === 'create'}
              className={`custom-tab-btn ${customTab === 'create' ? 'active' : ''}`}
              onClick={() => setCustomTab('create')}
            >
              ➕ Tạo phòng mới
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={customTab === 'join'}
              className={`custom-tab-btn ${customTab === 'join' ? 'active' : ''}`}
              onClick={() => setCustomTab('join')}
            >
              🔑 Nhập mã phòng
            </button>
          </div>

          {customTab === 'create' ? (
            <div className="custom-room-form">
              <div className="custom-field-group">
                <label className="custom-field-label">1. Chọn chế độ đấu</label>
                <div className="custom-choice-row">
                  <button
                    type="button"
                    className={`custom-choice-card ${customFormat === PlayFormat.RACE ? 'selected' : ''}`}
                    onClick={() => setCustomFormat(PlayFormat.RACE)}
                  >
                    <strong>⚡ Race</strong>
                    <span>Đua tốc độ 2 bàn riêng</span>
                  </button>
                  <button
                    type="button"
                    className={`custom-choice-card ${customFormat === PlayFormat.DUEL ? 'selected' : ''}`}
                    onClick={() => setCustomFormat(PlayFormat.DUEL)}
                  >
                    <strong>⚔️ Duel</strong>
                    <span>Luân phiên 1 bàn chung</span>
                  </button>
                </div>
              </div>

              <div className="custom-field-group">
                <label className="custom-field-label">2. Chọn bố cục bàn cờ</label>
                <div className="custom-choice-row">
                  <button
                    type="button"
                    className={`custom-choice-card ${customLayout === BoardLayoutType.STANDARD ? 'selected' : ''}`}
                    onClick={() => setCustomLayout(BoardLayoutType.STANDARD)}
                  >
                    <strong>▦ Standard 3×3</strong>
                    <span>Khối 3×3 tiêu chuẩn</span>
                  </button>
                  <button
                    type="button"
                    className={`custom-choice-card ${customLayout === BoardLayoutType.IRREGULAR ? 'selected' : ''}`}
                    onClick={() => setCustomLayout(BoardLayoutType.IRREGULAR)}
                  >
                    <strong>◈ Irregular</strong>
                    <span>Vùng bất quy tắc</span>
                  </button>
                </div>
              </div>

              <div className="custom-field-group">
                <label className="custom-field-label">3. Chọn độ khó</label>
                <div className="custom-level-grid">
                  {CUSTOM_LEVELS.map((lv) => (
                    <button
                      key={lv.value}
                      type="button"
                      className={`custom-level-btn ${customLevel === lv.value ? 'selected' : ''}`}
                      onClick={() => setCustomLevel(lv.value)}
                    >
                      <span
                        className="level-dot"
                        style={{ background: lv.color }}
                        aria-hidden="true"
                      />
                      <div>
                        <strong>{lv.label}</strong>
                        <small>{lv.desc}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCustomModalOpen(false)}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateCustomRoom}
                  disabled={isSubmittingCustom}
                >
                  Tạo phòng & Lấy mã 6 ký tự
                </button>
              </div>
            </div>
          ) : (
            <form className="custom-room-join-form" onSubmit={handleJoinCustomRoom}>
              <p className="custom-join-hint">
                Nhập mã phòng gồm <strong>6 ký tự</strong> do chủ phòng chia sẻ để vào
                trận ngay:
              </p>
              <input
                type="text"
                className="custom-code-input"
                placeholder="VD: A7K9Q2"
                maxLength={6}
                value={joinCodeInput}
                onChange={(e) =>
                  setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
                autoFocus
                aria-label="Mã phòng 6 ký tự"
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCustomModalOpen(false)}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={joinCodeInput.trim().length !== 6}
                >
                  Vào phòng ngay →
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  )
}
