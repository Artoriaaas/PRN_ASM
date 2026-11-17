import { useState, useEffect } from 'react'
import { adminGameClient } from '../../../api/adminClient'
import type { LevelConfigInfo } from '../../../gen/sudoku/game/v1/game_pb'

type RuleTab = 'single' | 'multiplayer' | 'quests'

interface SoloRuleItem {
  id: string
  icon: string
  title: string
  badge: string
  content: string
}

const DEFAULT_SOLO_RULES: SoloRuleItem[] = [
  {
    id: 'filling',
    icon: '✏️',
    title: 'Luật điền số chuẩn',
    badge: 'Quy tắc chuẩn',
    content: 'Điền các số từ 1 đến 9 sao cho mỗi hàng, mỗi cột và mỗi khối 3×3 có đủ 1–9, không trùng lặp.',
  },
  {
    id: 'mistakes',
    icon: '❤️',
    title: 'Giới hạn mạng (Mistakes)',
    badge: '3 Mạng',
    content: 'Mỗi lần điền số sai trừ 1 tim (mạng). Khi hết 3 mạng, ván đấu kết thúc thất bại. Điểm XP thưởng tính theo thời gian và tỷ lệ hoàn thành.',
  },
  {
    id: 'notes',
    icon: '✎',
    title: 'Chế độ Ghi chú (Notes)',
    badge: 'Hỗ trợ sẵn',
    content: 'Phím tắt N / nút Ghi chú: Lưu các số ứng viên nhỏ trong ô. Tự động xóa ghi chú khi số đúng cùng hàng, cột hoặc vùng được điền vào.',
  },
]

interface MultiplayerRuleSettings {
  racePenaltySeconds: number
  raceMaxMistakes: number
  duelTurnSeconds: number
  duelCorrectPoints: number
  duelWrongPoints: number
  duelMaxMistakes: number
}

const DEFAULT_MP_RULES: MultiplayerRuleSettings = {
  racePenaltySeconds: 10,
  raceMaxMistakes: 3,
  duelTurnSeconds: 15,
  duelCorrectPoints: 10,
  duelWrongPoints: 5,
  duelMaxMistakes: 3,
}

// Danh sách các mẫu nhiệm vụ trong hệ thống tự động sinh ngẫu nhiên
const DEFAULT_SYSTEM_QUESTS = [
  {
    id: 'quest-sys-1',
    code: 'SOLO_EASY_WIN',
    title: 'Khởi động ngày mới',
    description: 'Hoàn thành 1 ván Sudoku Classic cấp độ Dễ',
    conditionType: 'SOLO_FINISH',
    target: 1,
    progressSource: 'solo',
    rewardXp: 50,
    isActive: true,
  },
  {
    id: 'quest-sys-2',
    code: 'SOLO_SHUFFLE_PLAY',
    title: 'Thử thách Shuffle',
    description: 'Giải 1 ván Sudoku biến thể Shuffle (Bất quy tắc)',
    conditionType: 'SHUFFLE_FINISH',
    target: 1,
    progressSource: 'solo',
    rewardXp: 80,
    isActive: true,
  },
  {
    id: 'quest-sys-3',
    code: 'MULTI_RACE_WIN',
    title: 'Tay đua cự phách',
    description: 'Giành 1 chiến thắng trong chế độ Multiplayer Race',
    conditionType: 'RACE_WIN',
    target: 1,
    progressSource: 'multiplayer',
    rewardXp: 100,
    isActive: true,
  },
  {
    id: 'quest-sys-4',
    code: 'MULTI_DUEL_WIN',
    title: 'Chiến thuật gia',
    description: 'Giành chiến thắng trong 1 trận Multiplayer Duel',
    conditionType: 'DUEL_WIN',
    target: 1,
    progressSource: 'multiplayer',
    rewardXp: 100,
    isActive: true,
  },
  {
    id: 'quest-sys-5',
    code: 'SOLO_HARD_COMPLETE',
    title: 'Chinh phục độ khó',
    description: 'Vượt qua 1 ván Sudoku cấp độ Khó',
    conditionType: 'SOLO_HARD',
    target: 1,
    progressSource: 'solo',
    rewardXp: 120,
    isActive: true,
  },
]

export function AdminGameRulesPage() {
  const [activeTab, setActiveTab] = useState<RuleTab>('single')

  // Levels (Single)
  const [levels, setLevels] = useState<LevelConfigInfo[]>([])
  const [selectedLevel, setSelectedLevel] = useState<LevelConfigInfo | null>(null)
  const [levelModalOpen, setLevelModalOpen] = useState(false)
  const [minClues, setMinClues] = useState(30)
  const [maxClues, setMaxClues] = useState(36)
  const [maxMistakes, setMaxMistakes] = useState(3)
  const [maxHints, setMaxHints] = useState(3)
  const [levelActive, setLevelActive] = useState(true)
  const [scoreMultiplier, setScoreMultiplier] = useState(1.0)
  const [timeLimit, setTimeLimit] = useState(0)
  const [levelNotify, setLevelNotify] = useState(false)
  const [levelNotifyMsg, setLevelNotifyMsg] = useState('')
  const [levelReason, setLevelReason] = useState('')

  // Solo Core Rules (Ảnh 2)
  const [soloRules, setSoloRules] = useState<SoloRuleItem[]>(() => {
    try {
      const saved = localStorage.getItem('sudoku_solo_core_rules')
      return saved ? JSON.parse(saved) : DEFAULT_SOLO_RULES
    } catch {
      return DEFAULT_SOLO_RULES
    }
  })
  const [soloRuleModalOpen, setSoloRuleModalOpen] = useState(false)
  const [selectedSoloRule, setSelectedSoloRule] = useState<SoloRuleItem | null>(null)
  const [editRuleTitle, setEditRuleTitle] = useState('')
  const [editRuleBadge, setEditRuleBadge] = useState('')
  const [editRuleContent, setEditRuleContent] = useState('')
  const [ruleReason, setRuleReason] = useState('')

  // Multiplayer Rules
  const [mpRules, setMpRules] = useState<MultiplayerRuleSettings>(() => {
    try {
      const saved = localStorage.getItem('sudoku_mp_rules_settings')
      return saved ? JSON.parse(saved) : DEFAULT_MP_RULES
    } catch {
      return DEFAULT_MP_RULES
    }
  })
  const [mpModalOpen, setMpModalOpen] = useState(false)
  const [mpEditMode, setMpEditMode] = useState<'race' | 'duel'>('race')
  const [editMpPenalty, setEditMpPenalty] = useState(10)
  const [editMpTurnSeconds, setEditMpTurnSeconds] = useState(15)
  const [editMpCorrectPoints, setEditMpCorrectPoints] = useState(10)
  const [editMpWrongPoints, setEditMpWrongPoints] = useState(5)
  const [editMpMaxMistakes, setEditMpMaxMistakes] = useState(3)
  const [mpReason, setMpReason] = useState('')

  // Daily Tasks
  const [systemTasks, setSystemTasks] = useState(DEFAULT_SYSTEM_QUESTS)

  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const levelsRes = await adminGameClient.adminListLevelConfigs({})
      setLevels(levelsRes.levels)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi tải dữ liệu luật chơi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Single: Level Actions
  const openEditLevel = (lvl: LevelConfigInfo) => {
    setSelectedLevel(lvl)
    setMinClues(lvl.minClues)
    setMaxClues(lvl.maxClues)
    setMaxMistakes(lvl.maxMistakes)
    setMaxHints(lvl.maxHints)
    setLevelActive(lvl.isActive)
    setScoreMultiplier(lvl.scoreMultiplier)
    setTimeLimit(lvl.timeLimitSeconds)
    setLevelNotify(false)
    setLevelNotifyMsg('')
    setLevelReason('')
    setLevelModalOpen(true)
  }

  const handleSaveLevel = async () => {
    if (!selectedLevel || !levelReason.trim()) return
    if (minClues < 17 || maxClues > 80 || minClues > maxClues) {
      alert('Số ô gợi ý không hợp lệ: 17 <= min <= max <= 80.')
      return
    }
    setActionLoading(true)
    try {
      await adminGameClient.adminUpdateLevel({
        levelId: selectedLevel.levelId,
        minClues,
        maxClues,
        maxMistakes,
        maxHints,
        isActive: levelActive,
        scoreMultiplier,
        timeLimitSeconds: timeLimit,
        notifyPlayers: levelNotify,
        notificationMessage: levelNotifyMsg,
        reason: levelReason.trim(),
      })
      setLevelModalOpen(false)
      loadData()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi cập nhật độ khó.')
    } finally {
      setActionLoading(false)
    }
  }

  // Single: Core Rules Edit Actions (Ảnh 2)
  const openEditSoloRule = (rule: SoloRuleItem) => {
    setSelectedSoloRule(rule)
    setEditRuleTitle(rule.title)
    setEditRuleBadge(rule.badge)
    setEditRuleContent(rule.content)
    setRuleReason('')
    setSoloRuleModalOpen(true)
  }

  const handleSaveSoloRule = () => {
    if (!selectedSoloRule || !ruleReason.trim() || !editRuleTitle.trim() || !editRuleContent.trim()) {
      return
    }
    const updated = soloRules.map((r) =>
      r.id === selectedSoloRule.id
        ? {
            ...r,
            title: editRuleTitle.trim(),
            badge: editRuleBadge.trim(),
            content: editRuleContent.trim(),
          }
        : r,
    )
    setSoloRules(updated)
    try {
      localStorage.setItem('sudoku_solo_core_rules', JSON.stringify(updated))
    } catch {
      // Ignore quota
    }
    setSoloRuleModalOpen(false)
    alert(`Đã cập nhật quy tắc "${editRuleTitle}" thành công!`)
  }

  // Multiplayer Actions
  const openEditMp = (mode: 'race' | 'duel') => {
    setMpEditMode(mode)
    setEditMpPenalty(mpRules.racePenaltySeconds)
    setEditMpTurnSeconds(mpRules.duelTurnSeconds)
    setEditMpCorrectPoints(mpRules.duelCorrectPoints)
    setEditMpWrongPoints(mpRules.duelWrongPoints)
    setEditMpMaxMistakes(mode === 'race' ? mpRules.raceMaxMistakes : mpRules.duelMaxMistakes)
    setMpReason('')
    setMpModalOpen(true)
  }

  const handleSaveMpRules = () => {
    if (!mpReason.trim()) return
    const updated: MultiplayerRuleSettings = {
      ...mpRules,
      ...(mpEditMode === 'race'
        ? {
            racePenaltySeconds: Number(editMpPenalty),
            raceMaxMistakes: Number(editMpMaxMistakes),
          }
        : {
            duelTurnSeconds: Number(editMpTurnSeconds),
            duelCorrectPoints: Number(editMpCorrectPoints),
            duelWrongPoints: Number(editMpWrongPoints),
            duelMaxMistakes: Number(editMpMaxMistakes),
          }),
    }
    setMpRules(updated)
    try {
      localStorage.setItem('sudoku_mp_rules_settings', JSON.stringify(updated))
    } catch {
      // Ignore quota
    }
    setMpModalOpen(false)
    alert(`Đã lưu cấu hình luật ${mpEditMode === 'race' ? 'Race' : 'Duel'} thành công!`)
  }

  // Toggle Quest mẫu
  const handleToggleSystemQuest = (questId: string) => {
    setSystemTasks((prev) =>
      prev.map((q) => (q.id === questId ? { ...q, isActive: !q.isActive } : q)),
    )
  }

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>Quản lý luật chơi & Cấu hình game</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Điều chỉnh luật chơi hiển thị trực tiếp cho người chơi ở màn hình Solo, Multiplayer và Nhiệm vụ hằng ngày.
          </p>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
        >
          🎮 Chơi đơn (Solo Rules)
        </button>
        <button
          className={`admin-tab ${activeTab === 'multiplayer' ? 'active' : ''}`}
          onClick={() => setActiveTab('multiplayer')}
        >
          ⚔️ Đấu nhiều người (Multiplayer)
        </button>
        <button
          className={`admin-tab ${activeTab === 'quests' ? 'active' : ''}`}
          onClick={() => setActiveTab('quests')}
        >
          ✦ Nhiệm vụ hằng ngày (Quests)
        </button>
      </div>

      {loading && <div style={{ padding: 20 }}>Đang đồng bộ dữ liệu luật chơi...</div>}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: CHƠI ĐƠN (SOLO RULES)                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'single' && (
        <div>
          {/* Section 1: 4 Cấp độ khó */}
          <div className="admin-rules-section">
            <h2 className="admin-rules-title">
              <span>🎯</span> 1. Cấu hình 4 Cấp độ khó (Difficulty Levels)
            </h2>
            <p style={{ margin: '-8px 0 14px 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
              Quyết định số ô cho sẵn (Min–Max Clues), số lần sai tối đa (mạng) và giới hạn thời gian khi người chơi giải Sudoku Solo.
            </p>
            <div className="admin-card">
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tên độ khó</th>
                      <th>Ô cho sẵn (Min - Max)</th>
                      <th>Mạng tối đa</th>
                      <th>Gợi ý (Hint)</th>
                      <th>Hệ số điểm</th>
                      <th>Giới hạn tg (s)</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {levels.map((lvl) => (
                      <tr key={lvl.levelId}>
                        <td>
                          <code>{lvl.levelId}</code>
                        </td>
                        <td>
                          <strong>{lvl.name}</strong>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--green)' }}>
                            {lvl.minClues} – {lvl.maxClues} ô
                          </span>
                        </td>
                        <td>{lvl.maxMistakes} mạng</td>
                        <td>{lvl.maxHints} lần</td>
                        <td>x{lvl.scoreMultiplier}</td>
                        <td>{lvl.timeLimitSeconds > 0 ? `${lvl.timeLimitSeconds}s` : 'Không giới hạn'}</td>
                        <td>
                          <span className={`badge ${lvl.isActive ? 'badge-active' : 'badge-banned'}`}>
                            {lvl.isActive ? 'BẬT' : 'TẮT'}
                          </span>
                        </td>
                        <td className="admin-actions-cell">
                          <button
                            className="admin-btn admin-btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                            onClick={() => openEditLevel(lvl)}
                          >
                            Chỉnh sửa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 2: Quy tắc cốt lõi Chơi đơn — Dạng danh sách bảng */}
          <div className="admin-rules-section">
            <h2 className="admin-rules-title">
              <span>📖</span> 2. Quy tắc cốt lõi Chơi đơn (Solo Gameplay Rules)
            </h2>
            <p style={{ margin: '-8px 0 14px 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
              Các quy tắc luật chơi hiển thị trực tiếp cho người chơi trong game. Bạn có thể nhấn Chỉnh sửa để cập nhật nội dung quy tắc.
            </p>
            <div className="admin-card">
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Quy tắc</th>
                      <th style={{ width: '15%' }}>Phân loại</th>
                      <th>Nội dung luật chơi chi tiết</th>
                      <th style={{ width: '1%', whiteSpace: 'nowrap', textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soloRules.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                            <span style={{ fontSize: '1.2rem' }}>{r.icon}</span>
                            <span>{r.title}</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-active">{r.badge}</span>
                        </td>
                        <td style={{ color: 'var(--ink)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                          {r.content}
                        </td>
                        <td className="admin-actions-cell">
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                            onClick={() => openEditSoloRule(r)}
                          >
                            ✏️ Chỉnh sửa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: ĐẤU NHIỀU NGƯỜI (MULTIPLAYER RULES)                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'multiplayer' && (
        <div>
          <div className="admin-rules-section">
            <h2 className="admin-rules-title">
              <span>⚔️</span> Quy tắc các Chế độ Đấu trực tiếp (Multiplayer Match Rules)
            </h2>
            <p style={{ margin: '-8px 0 16px 0', color: 'var(--muted)', fontSize: '0.88rem' }}>
              Các thông số này được liên kết trực tiếp với popup "Luật chơi Multiplayer" và cơ chế tính thắng thua trong các phòng đấu thời gian thực.
            </p>

            <div className="admin-card">
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Chế độ</th>
                      <th style={{ width: '14%' }}>Thể thức</th>
                      <th style={{ width: '32%' }}>Mô tả lối chơi</th>
                      <th>Thông số cấu hình hiện tại</th>
                      <th style={{ width: '1%', whiteSpace: 'nowrap', textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Hàng Race */}
                    <tr>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                          <span style={{ fontSize: '1.2rem' }}>⚡</span>
                          <span>Chế độ Race (Đua tốc độ)</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-user">Đua song song</span>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                        Hai kỳ thủ nhận cùng một đề Sudoku và thi đấu giải song song. Người hoàn thành đúng đầu tiên sẽ chiến thắng.
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem' }}>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Phạt điền sai: </span>
                            <strong style={{ color: 'var(--danger)' }}>+{mpRules.racePenaltySeconds}s / lần sai</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Số mạng: </span>
                            <strong>{mpRules.raceMaxMistakes} mạng (hết mạng = thua)</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Xếp hạng: </span>
                            <strong style={{ color: 'var(--green)' }}>Elo Race độc lập</strong>
                          </div>
                        </div>
                      </td>
                      <td className="admin-actions-cell">
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                          onClick={() => openEditMp('race')}
                        >
                          ⚙️ Chỉnh sửa
                        </button>
                      </td>
                    </tr>

                    {/* Hàng Duel */}
                    <tr>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                          <span style={{ fontSize: '1.2rem' }}>♟️</span>
                          <span>Chế độ Duel (Đấu trí luân phiên)</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-admin">Chung bàn cờ</span>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                        Hai kỳ thủ dùng chung 1 bàn cờ duy nhất, luân phiên điền số. Chiến thuật chặn nước và tranh điểm tốc độ.
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem' }}>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Thời gian lượt: </span>
                            <strong style={{ color: 'var(--warning)' }}>{mpRules.duelTurnSeconds}s / lượt</strong>
                            {' • '}
                            <span style={{ color: 'var(--muted)' }}>Điểm đúng: </span>
                            <strong style={{ color: 'var(--green)' }}>+{mpRules.duelCorrectPoints} điểm</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Phạt sai: </span>
                            <strong style={{ color: 'var(--danger)' }}>-{mpRules.duelWrongPoints} điểm (mất lượt & lộ số)</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Số mạng: </span>
                            <strong>{mpRules.duelMaxMistakes} mạng</strong>
                            {' • '}
                            <span style={{ color: 'var(--muted)' }}>Xếp hạng: </span>
                            <strong style={{ color: 'var(--green)' }}>Elo Duel độc lập</strong>
                          </div>
                        </div>
                      </td>
                      <td className="admin-actions-cell">
                        <button
                          type="button"
                          className="admin-btn admin-btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                          onClick={() => openEditMp('duel')}
                        >
                          ⚙️ Chỉnh sửa
                        </button>
                      </td>
                    </tr>

                    {/* Hàng Custom Room */}
                    <tr>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                          <span style={{ fontSize: '1.2rem' }}>🔑</span>
                          <span>Custom Room (Phòng bạn bè)</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-resolved">Tùy biến cao</span>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: '0.86rem', lineHeight: 1.5 }}>
                        Cho phép người chơi tự tạo phòng riêng với mã mời 6 ký tự viết hoa hoặc tham gia phòng bạn bè tạo sẵn.
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem' }}>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Mã phòng: </span>
                            <strong>6 ký tự in hoa (A-Z, 0-9)</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Thể thức thi đấu: </span>
                            <strong>Race hoặc Duel</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--muted)' }}>Cấp độ tùy chọn: </span>
                            <strong>Dễ, Trung bình, Khó, Chuyên gia</strong>
                          </div>
                        </div>
                      </td>
                      <td className="admin-actions-cell">
                        <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                          Áp dụng theo Race / Duel
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: NHIỆM VỤ HẰNG NGÀY (DAILY QUESTS)                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {!loading && activeTab === 'quests' && (
        <div>
          <div className="admin-rules-section">
            <h2 className="admin-rules-title">
              <span>✦</span> Kho nhiệm vụ sinh ngẫu nhiên hằng ngày
            </h2>
            <div className="alert-warning" style={{ marginBottom: 18 }}>
              💡 <strong>Cơ chế tự động:</strong> Mỗi ngày hệ thống tự động quay số ngẫu nhiên 3 nhiệm vụ cho từng người chơi dựa trên kho nhiệm vụ đang kích hoạt bên dưới. Quản trị viên chỉ cần quản lý danh sách nhiệm vụ được phép xuất hiện mà không cần phải thêm thủ công mỗi ngày.
            </div>

            <div className="admin-card">
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Mã nhiệm vụ</th>
                      <th>Tên nhiệm vụ</th>
                      <th>Yêu cầu hoàn thành</th>
                      <th>Nguồn tiến độ</th>
                      <th>Phần thưởng XP</th>
                      <th>Trạng thái quay số</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemTasks.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <code>{t.code}</code>
                        </td>
                        <td>
                          <strong>{t.title}</strong>
                        </td>
                        <td>{t.description}</td>
                        <td>
                          <span
                            className={`badge ${
                              t.progressSource === 'multiplayer' ? 'badge-admin' : 'badge-user'
                            }`}
                          >
                            {t.progressSource.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: 'var(--green)' }}>+{t.rewardXp} XP</strong>
                        </td>
                        <td>
                          <span className={`badge ${t.isActive ? 'badge-active' : 'badge-banned'}`}>
                            {t.isActive ? 'CHO PHÉP QUAY' : 'TẠM TẮT'}
                          </span>
                        </td>
                        <td className="admin-actions-cell">
                          <button
                            type="button"
                            className={`admin-btn ${
                              t.isActive ? 'admin-btn-secondary' : 'admin-btn-primary'
                            }`}
                            style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                            onClick={() => handleToggleSystemQuest(t.id)}
                          >
                            {t.isActive ? 'Tạm tắt' : 'Kích hoạt'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 1: CHỈNH SỬA ĐỘ KHÓ (GỌN GÀNG, VỪA VẶN MÀN HÌNH)       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {levelModalOpen && selectedLevel && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Chỉnh sửa cấp độ: {selectedLevel.name}</h3>
              <button
                className="admin-btn admin-btn-secondary"
                style={{ padding: '4px 8px' }}
                onClick={() => setLevelModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label>Số ô gợi ý tối thiểu (Min):</label>
                  <input
                    type="number"
                    min="17"
                    max="80"
                    value={minClues}
                    onChange={(e) => setMinClues(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Số ô gợi ý tối đa (Max):</label>
                  <input
                    type="number"
                    min="17"
                    max="80"
                    value={maxClues}
                    onChange={(e) => setMaxClues(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Số lần sai tối đa (Mạng):</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxMistakes}
                    onChange={(e) => setMaxMistakes(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Số lượt Hint tối đa:</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={maxHints}
                    onChange={(e) => setMaxHints(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Hệ số điểm:</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="10"
                    value={scoreMultiplier}
                    onChange={(e) => setScoreMultiplier(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Giới hạn tg (0 = Tắt):</label>
                  <input
                    type="number"
                    min="0"
                    step="30"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  id="levelActiveCheck"
                  checked={levelActive}
                  onChange={(e) => setLevelActive(e.target.checked)}
                />
                <label htmlFor="levelActiveCheck" style={{ cursor: 'pointer' }}>
                  Kích hoạt cấp độ này cho người chơi
                </label>
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--line)',
                  paddingTop: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    id="levelNotifyCheck"
                    checked={levelNotify}
                    onChange={(e) => setLevelNotify(e.target.checked)}
                  />
                  <label htmlFor="levelNotifyCheck" style={{ cursor: 'pointer' }}>
                    📢 Phát thông báo thay đổi cho người chơi
                  </label>
                </div>
                {levelNotify && (
                  <textarea
                    placeholder="Nội dung thông báo gửi đến người chơi..."
                    value={levelNotifyMsg}
                    onChange={(e) => setLevelNotifyMsg(e.target.value)}
                  />
                )}
              </div>

              <div className="form-group">
                <label>Lý do cập nhật (Bắt buộc ghi audit):</label>
                <input
                  type="text"
                  placeholder="Nhập lý do thay đổi..."
                  value={levelReason}
                  onChange={(e) => setLevelReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setLevelModalOpen(false)}
              >
                Hủy
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={handleSaveLevel}
                disabled={actionLoading || !levelReason.trim()}
              >
                {actionLoading ? 'Đang lưu...' : 'Lưu độ khó'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 2: CHỈNH SỬA QUY TẮC CỐT LÕI CHƠI ĐƠN (ẢNH 2)           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {soloRuleModalOpen && selectedSoloRule && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>
                {selectedSoloRule.icon} Chỉnh sửa: {selectedSoloRule.title}
              </h3>
              <button
                className="admin-btn admin-btn-secondary"
                style={{ padding: '4px 8px' }}
                onClick={() => setSoloRuleModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tên quy tắc:</label>
                <input
                  type="text"
                  value={editRuleTitle}
                  onChange={(e) => setEditRuleTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Nhãn / Badge hiển thị:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Quy tắc chuẩn, 3 Mạng, Hỗ trợ sẵn..."
                  value={editRuleBadge}
                  onChange={(e) => setEditRuleBadge(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Nội dung chi tiết quy tắc (Hiển thị cho User):</label>
                <textarea
                  style={{ minHeight: 85 }}
                  value={editRuleContent}
                  onChange={(e) => setEditRuleContent(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Lý do cập nhật (Bắt buộc ghi audit):</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Làm rõ mô tả cách tính mạng khi sai..."
                  value={ruleReason}
                  onChange={(e) => setRuleReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setSoloRuleModalOpen(false)}
              >
                Hủy
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={handleSaveSoloRule}
                disabled={!ruleReason.trim() || !editRuleTitle.trim()}
              >
                Lưu quy tắc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL 3: CHỈNH SỬA THAM SỐ MULTIPLAYER (RACE / DUEL)          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {mpModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>
                Chỉnh sửa luật:{' '}
                {mpEditMode === 'race' ? '⚡ Race (Đua tốc độ)' : '♟️ Duel (Đấu luân phiên)'}
              </h3>
              <button
                className="admin-btn admin-btn-secondary"
                style={{ padding: '4px 8px' }}
                onClick={() => setMpModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {mpEditMode === 'race' ? (
                <>
                  <div className="form-group">
                    <label>Thời gian phạt khi điền sai (Giây cộng thêm):</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={editMpPenalty}
                      onChange={(e) => setEditMpPenalty(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Số mạng tối đa (Hết mạng bị xử thua):</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={editMpMaxMistakes}
                      onChange={(e) => setEditMpMaxMistakes(Number(e.target.value))}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Thời gian suy nghĩ mỗi lượt (Giây):</label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={editMpTurnSeconds}
                      onChange={(e) => setEditMpTurnSeconds(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Điểm cộng khi điền đúng (+điểm):</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={editMpCorrectPoints}
                      onChange={(e) => setEditMpCorrectPoints(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Điểm trừ khi điền sai (-điểm):</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={editMpWrongPoints}
                      onChange={(e) => setEditMpWrongPoints(Number(e.target.value))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Số mạng tối đa:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={editMpMaxMistakes}
                      onChange={(e) => setEditMpMaxMistakes(Number(e.target.value))}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Lý do cập nhật luật (Bắt buộc ghi audit):</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Cân bằng thời gian trận đấu..."
                  value={mpReason}
                  onChange={(e) => setMpReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setMpModalOpen(false)}
              >
                Hủy
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={handleSaveMpRules}
                disabled={!mpReason.trim()}
              >
                Lưu quy tắc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
