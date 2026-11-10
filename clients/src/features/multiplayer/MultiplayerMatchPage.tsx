import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import type { UserProfile } from '../../gen/sudoku/user/v1/user_pb'
import { SudokuBoard } from '../../components/SudokuBoard'
import { NumberPad } from '../../components/NumberPad'
import { GameTimer } from '../../components/GameTimer'
import { LivesIndicator } from '../../components/LivesIndicator'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import {
  STANDARD_REGION_MAP,
  toggleNote,
  getPeers,
  indexToRC,
} from '../../lib/board'
import { PlayFormat, BoardLayoutType } from '../../api/multiClient'
import {
  matchHub,
  type MatchStartedPayload,
} from '../../realtime/matchHubClient'

type MultiplayerMatchPageProps = {
  profile: UserProfile | null
}

function cleanPeerNotes(
  notes: Uint16Array,
  index: number,
  digit: number,
  regionMap: string,
): Uint16Array {
  const next = new Uint16Array(notes)
  next[index] = 0
  const bit = 1 << (digit - 1)
  for (const peer of getPeers(index, regionMap)) {
    next[peer] &= ~bit
  }
  return next
}

function parseBoard(str: string): Uint8Array {
  const arr = new Uint8Array(81)
  for (let i = 0; i < 81; i++) {
    const ch = str[i] ?? '0'
    if (ch >= '1' && ch <= '9') {
      arr[i] = Number(ch)
    }
  }
  return arr
}

/**
 * DuelTurnClock — tách riêng khỏi component bàn cờ để không ép 81 ô re-render mỗi nhịp đếm ngược.
 */
function DuelTurnClock({
  deadlineIso,
  isMyTurn,
  turnSeconds = 15,
}: {
  deadlineIso: string
  isMyTurn: boolean
  turnSeconds?: number
}) {
  const [remainingSec, setRemainingSec] = useState<number>(turnSeconds)

  useEffect(() => {
    const deadlineMs = new Date(deadlineIso).getTime()
    const update = () => {
      const diff = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))
      setRemainingSec(diff)
    }
    update()
    const id = window.setInterval(update, 250)
    return () => clearInterval(id)
  }, [deadlineIso, turnSeconds])

  const urgent = remainingSec <= 5

  return (
    <div
      className={`duel-turn-clock ${isMyTurn ? 'my-turn' : 'opp-turn'} ${urgent ? 'urgent' : ''}`}
      aria-label={`Còn ${remainingSec} giây cho lượt hiện tại`}
    >
      <span className="turn-clock-sec">{remainingSec}s</span>
      <span className="turn-clock-label">
        {isMyTurn ? '▲ LƯỢT CỦA BẠN' : '⏳ LƯỢT ĐỐI THỦ'}
      </span>
    </div>
  )
}

type MoveFeedEntry = {
  id: string
  actor: 'self' | 'opponent'
  text: string
  points?: number
  ok: boolean
}

export function MultiplayerMatchPage({ profile }: MultiplayerMatchPageProps) {
  const { matchId = '' } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()

  const locationState = location.state as { match?: MatchStartedPayload } | null
  const [matchPayload] = useState<MatchStartedPayload | null>(() => {
    if (locationState?.match && locationState.match.matchId === matchId) {
      return locationState.match
    }
    return matchHub.getActiveMatch(matchId) || matchHub.getActiveMatch()
  })

  const callerIdentity = matchHub.getCallerIdentity(profile?.displayName)
  const myUid = callerIdentity.userId

  const isP1Me = matchPayload
    ? matchPayload.player1.userId === myUid || matchPayload.player2.userId !== myUid
    : true
  const meInfo = matchPayload
    ? isP1Me
      ? matchPayload.player1
      : matchPayload.player2
    : {
        userId: myUid,
        displayName: profile?.displayName || callerIdentity.displayName,
        rating: 1000,
        turnOrder: 1,
        lives: 3,
      }
  const oppInfo = matchPayload
    ? isP1Me
      ? matchPayload.player2
      : matchPayload.player1
    : {
        userId: 'opponent',
        displayName: 'Đối thủ',
        rating: 1000,
        turnOrder: 2,
        lives: 3,
      }

  const isDuel = matchPayload?.playFormat === PlayFormat.DUEL
  const initialBoard = matchPayload?.initial || '0'.repeat(81)
  const regionMap = matchPayload?.regionMap || STANDARD_REGION_MAP
  const maxLives = matchPayload?.rules?.lives || 3

  const [cells, setCells] = useState<Uint8Array>(() => parseBoard(initialBoard))
  const [notes, setNotes] = useState<Uint16Array>(() => new Uint16Array(81))
  const [selected, setSelected] = useState<number | null>(null)
  const [notesMode, setNotesMode] = useState(false)
  const [wrongCells, setWrongCells] = useState<Set<number>>(() => new Set())
  const [recentOpponentCell, setRecentOpponentCell] = useState<number | null>(null)
  const [revealedWrongDigits, setRevealedWrongDigits] = useState<Record<number, number[]>>({})

  // Self & Opponent stats
  const [myLives, setMyLives] = useState<number>(meInfo.lives || maxLives)
  const [myMistakes, setMyMistakes] = useState<number>(0)
  const [myScore, setMyScore] = useState<number>(0)
  const [myPenaltySec, setMyPenaltySec] = useState<number>(0)
  const [myProgress, setMyProgress] = useState<number>(0)

  const [oppLives, setOppLives] = useState<number>(oppInfo.lives || maxLives)
  const [, setOppMistakes] = useState<number>(0)
  const [oppScore, setOppScore] = useState<number>(0)
  const [oppProgress, setOppProgress] = useState<number>(0)
  const [oppDisconnected, setOppDisconnected] = useState<boolean>(false)

  // Duel turn state
  const [currentTurnUserId, setCurrentTurnUserId] = useState<string>(
    matchPayload?.currentTurnUserId || meInfo.userId,
  )
  const [turnNumber, setTurnNumber] = useState<number>(matchPayload?.turn || 1)
  const [turnDeadline, setTurnDeadline] = useState<string>(
    () => matchPayload?.turnDeadline || matchPayload?.startedAt || '',
  )
  const [moveFeed, setMoveFeed] = useState<MoveFeedEntry[]>([])

  // Modals / Actions
  const [resignModalOpen, setResignModalOpen] = useState(false)
  const [isResigning, setIsResigning] = useState(false)
  const opponentFlashTimerRef = useRef<number | undefined>(undefined)

  const isMyTurn = !isDuel || currentTurnUserId === meInfo.userId

  // Subscribe to MatchHub realtime events
  useEffect(() => {
    if (!matchPayload) {
      navigate('/play', { replace: true })
      return
    }

    if (matchPayload.isSimulated) {
      matchHub.startBotSimulationForMatch(matchPayload.matchId)
    }

    const unsubMove = matchHub.onMoveResult((res) => {
      if (res.matchId !== matchPayload.matchId) return
      const isMine = res.userId === meInfo.userId
      const [r, c] = indexToRC(res.i)
      const coordLabel = `(${r + 1},${c + 1})`

      if (isMine) {
        setMyLives(res.lives)
        setMyMistakes(res.mistakes)
        setMyScore(res.score)
        if (typeof res.penaltySec === 'number') setMyPenaltySec(res.penaltySec)
        if (typeof res.progressPercent === 'number') setMyProgress(res.progressPercent)

        if (res.ok) {
          setCells((prev) => {
            const next = new Uint8Array(prev)
            next[res.i] = res.v
            return next
          })
          setNotes((prev) => cleanPeerNotes(prev, res.i, res.v, regionMap))
          setWrongCells((prev) => {
            if (!prev.has(res.i)) return prev
            const next = new Set(prev)
            next.delete(res.i)
            return next
          })
          if (isDuel && res.points) {
            setMoveFeed((prev) => [
              {
                id: `${Date.now()}-${Math.random()}`,
                actor: 'self',
                text: `Bạn điền số ${res.v} tại ô ${coordLabel}`,
                points: res.points,
                ok: true,
              },
              ...prev.slice(0, 7),
            ])
          }
        } else {
          // Revert optimistic value on wrong move
          setCells((prev) => {
            const next = new Uint8Array(prev)
            next[res.i] = 0
            return next
          })
          setWrongCells((prev) => {
            const next = new Set(prev)
            next.add(res.i)
            return next
          })
          if (res.revealedWrongDigits) {
            setRevealedWrongDigits((prev) => ({
              ...prev,
              [res.i]: res.revealedWrongDigits!,
            }))
          }
          if (isDuel) {
            showToast(`Nước đi sai! -5 điểm & mất lượt`, 'error')
            setMoveFeed((prev) => [
              {
                id: `${Date.now()}-${Math.random()}`,
                actor: 'self',
                text: `Bạn thử sai số ${res.v} tại ô ${coordLabel}`,
                points: -5,
                ok: false,
              },
              ...prev.slice(0, 7),
            ])
          } else if (!res.isDuplicateWrong) {
            showToast(
              `Điền sai! +${matchPayload.rules?.wrongTimePenaltySeconds || 10}s phạt`,
              'error',
            )
          }
        }
      } else {
        // Opponent move in Duel mode
        setOppLives(res.lives)
        setOppMistakes(res.mistakes)
        setOppScore(res.score)

        if (res.ok) {
          setCells((prev) => {
            const next = new Uint8Array(prev)
            next[res.i] = res.v
            return next
          })
          setNotes((prev) => cleanPeerNotes(prev, res.i, res.v, regionMap))
          setRecentOpponentCell(res.i)
          clearTimeout(opponentFlashTimerRef.current)
          opponentFlashTimerRef.current = window.setTimeout(() => {
            setRecentOpponentCell(null)
          }, 800)

          setMoveFeed((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              actor: 'opponent',
              text: `${oppInfo.displayName} điền số ${res.v} tại ô ${coordLabel}`,
              points: res.points,
              ok: true,
            },
            ...prev.slice(0, 7),
          ])
        } else {
          if (res.revealedWrongDigits) {
            setRevealedWrongDigits((prev) => ({
              ...prev,
              [res.i]: res.revealedWrongDigits!,
            }))
          }
          setMoveFeed((prev) => [
            {
              id: `${Date.now()}-${Math.random()}`,
              actor: 'opponent',
              text: `${oppInfo.displayName} thử sai số ${res.v} tại ô ${coordLabel}`,
              points: -5,
              ok: false,
            },
            ...prev.slice(0, 7),
          ])
        }
      }
    })

    const unsubProgress = matchHub.onOpponentProgress((prog) => {
      if (prog.matchId !== matchPayload.matchId) return
      setOppLives(prog.lives)
      setOppMistakes(prog.mistakes)
      setOppProgress(prog.progressPercent)
    })

    const unsubTurn = matchHub.onTurnChanged((turnEvt) => {
      if (turnEvt.matchId !== matchPayload.matchId) return
      setCurrentTurnUserId(turnEvt.userId)
      setTurnNumber(turnEvt.turn)
      setTurnDeadline(turnEvt.deadline)
    })

    const unsubEnded = matchHub.onMatchEnded((ended) => {
      if (ended.matchId !== matchPayload.matchId) return
      navigate(`/match/${matchPayload.matchId}/result`, {
        replace: true,
        state: { result: ended, match: matchPayload },
      })
    })

    const unsubSynced = matchHub.onRoomStateSynced((sync) => {
      if (sync.matchId !== matchPayload.matchId) return
      setCells(parseBoard(sync.myBoard))
      setMyLives(sync.myLives)
      setMyMistakes(sync.myMistakes)
      setMyScore(sync.myScore)
      setMyPenaltySec(sync.myPenaltySec)
      setMyProgress(sync.myProgressPercent)
      setOppLives(sync.opponent.lives)
      setOppMistakes(sync.opponent.mistakes)
      setOppScore(sync.opponent.score)
      setOppProgress(sync.opponent.progressPercent)
      setOppDisconnected(sync.opponent.isDisconnected)
      setCurrentTurnUserId(sync.currentTurnUserId)
      setTurnNumber(sync.turn)
      setTurnDeadline(sync.turnDeadline)
      setRevealedWrongDigits(sync.revealedWrongDigits || {})
    })

    const unsubDisc = matchHub.onOpponentDisconnected((evt) => {
      if (evt.matchId !== matchPayload.matchId) return
      setOppDisconnected(true)
      showToast(`Đối thủ mất kết nối (chờ ${evt.graceSeconds}s)...`, 'info')
    })

    const unsubReconn = matchHub.onOpponentReconnected((evt) => {
      if (evt.matchId !== matchPayload.matchId) return
      setOppDisconnected(false)
      showToast('Đối thủ đã kết nối lại!', 'info')
    })

    return () => {
      clearTimeout(opponentFlashTimerRef.current)
      unsubMove()
      unsubProgress()
      unsubTurn()
      unsubEnded()
      unsubSynced()
      unsubDisc()
      unsubReconn()
    }
  }, [matchPayload, meInfo.userId, oppInfo.displayName, isDuel, regionMap, navigate, showToast])

  const handleSelectCell = useCallback((index: number) => {
    setSelected(index)
  }, [])

  const handleInputNumber = useCallback(
    (n: number) => {
      if (selected === null || !matchPayload) return
      if (initialBoard[selected] !== '0' && initialBoard[selected] !== '.') return
      if (cells[selected] !== 0) return

      // Pencil notes are always allowed (even during opponent's turn in Duel)
      if (notesMode) {
        setNotes((prev) => {
          const next = new Uint16Array(prev)
          next[selected] = toggleNote(next[selected], n)
          return next
        })
        return
      }

      if (isDuel && !isMyTurn) {
        showToast('Đang là lượt của đối thủ! Bạn có thể bật Ghi chú (N) để nháp.', 'info')
        return
      }

      // 0ms Optimistic UI update
      setCells((prev) => {
        const next = new Uint8Array(prev)
        next[selected] = n
        return next
      })
      setWrongCells((prev) => {
        if (!prev.has(selected)) return prev
        const next = new Set(prev)
        next.delete(selected)
        return next
      })

      matchHub
        .submitMove({
          matchId: matchPayload.matchId,
          cellIndex: selected,
          value: n,
          turnNumber,
        })
        .catch((err) => {
          showToast(
            err instanceof Error ? err.message : 'Không thể gửi nước đi.',
            'error',
          )
        })
    },
    [selected, matchPayload, initialBoard, cells, notesMode, isDuel, isMyTurn, turnNumber, showToast],
  )

  const handleDelete = useCallback(() => {
    if (selected === null) return
    if (notes[selected] !== 0) {
      setNotes((prev) => {
        const next = new Uint16Array(prev)
        next[selected] = 0
        return next
      })
    }
  }, [selected, notes])

  const handleToggleNotes = useCallback(() => {
    setNotesMode((m) => !m)
  }, [])

  // Keyboard shortcuts: 1-9, N (notes), Backspace/Delete
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (resignModalOpen) return
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        handleInputNumber(Number(e.key))
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handleToggleNotes()
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault()
        handleDelete()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [resignModalOpen, handleInputNumber, handleToggleNotes, handleDelete])

  async function handleConfirmResign() {
    if (!matchPayload || isResigning) return
    setIsResigning(true)
    try {
      await matchHub.resign(matchPayload.matchId)
    } catch {
      setIsResigning(false)
    }
  }

  if (!matchPayload) {
    return null
  }

  const startedAtMs = new Date(matchPayload.startedAt).getTime()
  const selectedRevealedWrong =
    selected !== null ? revealedWrongDigits[selected] || [] : []

  return (
    <div className="multi-match-page">
      {/* Top Bar trận đấu */}
      <header className="multi-match-topbar">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setResignModalOpen(true)}
        >
          🏳️ Đầu hàng
        </button>

        <div className="multi-match-badges">
          <span className={`match-mode-badge ${isDuel ? 'duel' : 'race'}`}>
            {isDuel ? '⚔️ DUEL' : '⚡ RACE'}
          </span>
          <span className="match-meta-badge">
            {matchPayload.boardLayout === BoardLayoutType.IRREGULAR
              ? '◈ Irregular'
              : '▦ Standard'}
          </span>
          <span className="match-meta-badge">
            Độ khó: {matchPayload.levelId.toUpperCase()}
          </span>
          {matchPayload.roomCode && (
            <span className="match-meta-badge room">
              Phòng: {matchPayload.roomCode}
            </span>
          )}
        </div>

        <GameTimer startedAt={startedAtMs} />
      </header>

      {/* Thanh đối kháng: Race Progress hoặc Duel ScoreBoard */}
      {isDuel ? (
        <section className="duel-HUD" aria-label="Bảng điểm và lượt đấu Duel">
          {/* Bên trái: Bản thân */}
          <div className={`duel-player-panel self ${isMyTurn ? 'active-turn' : ''}`}>
            <div className="duel-player-avatar self">
              {(meInfo.displayName[0] || 'B').toUpperCase()}
            </div>
            <div className="duel-player-info">
              <div className="duel-player-name-row">
                <strong>{meInfo.displayName}</strong>
                <span className="duel-elo-tag">{meInfo.rating} ELO</span>
              </div>
              <LivesIndicator lives={myLives} maxLives={maxLives} />
            </div>
            <div className="duel-player-score">
              <span className="score-number">{myScore}</span>
              <span className="score-unit">ĐIỂM</span>
            </div>
          </div>

          {/* Ở giữa: Đồng hồ đếm ngược 15s theo lượt */}
          <DuelTurnClock
            deadlineIso={turnDeadline}
            isMyTurn={isMyTurn}
            turnSeconds={matchPayload.rules?.turnSeconds || 15}
          />

          {/* Bên phải: Đối thủ */}
          <div className={`duel-player-panel opponent ${!isMyTurn ? 'active-turn' : ''}`}>
            <div className="duel-player-score">
              <span className="score-number">{oppScore}</span>
              <span className="score-unit">ĐIỂM</span>
            </div>
            <div className="duel-player-info align-right">
              <div className="duel-player-name-row">
                <span className="duel-elo-tag">{oppInfo.rating} ELO</span>
                <strong>{oppInfo.displayName}</strong>
              </div>
              <LivesIndicator lives={oppLives} maxLives={maxLives} />
            </div>
            <div className="duel-player-avatar opponent">
              {(oppInfo.displayName[0] || 'Đ').toUpperCase()}
            </div>
          </div>
        </section>
      ) : (
        <section className="race-HUD" aria-label="Tiến độ đua tốc độ Race">
          {/* Thanh tiến độ của Bạn */}
          <div className="race-lane self">
            <div className="race-lane-top">
              <div className="race-Competitor">
                <span className="race-avatar self">
                  {(meInfo.displayName[0] || 'B').toUpperCase()}
                </span>
                <div>
                  <strong>{meInfo.displayName} (Bạn)</strong>
                  <small>{meInfo.rating} ELO</small>
                </div>
              </div>
              <div className="race-metrics">
                {myPenaltySec > 0 && (
                  <span className="race-penalty-chip">+{myPenaltySec}s phạt</span>
                )}
                <LivesIndicator lives={myLives} maxLives={maxLives} />
                <strong className="race-percent">{myProgress}%</strong>
              </div>
            </div>
            <div className="race-progress-bar">
              <div
                className="race-progress-fill self"
                style={{ width: `${Math.min(100, myProgress)}%` }}
              />
            </div>
          </div>

          {/* Thanh tiến độ của Đối thủ */}
          <div className="race-lane opponent">
            <div className="race-lane-top">
              <div className="race-Competitor">
                <span className="race-avatar opponent">
                  {(oppInfo.displayName[0] || 'Đ').toUpperCase()}
                </span>
                <div>
                  <strong>
                    {oppInfo.displayName}
                    {oppDisconnected ? ' (Mất kết nối...)' : ''}
                  </strong>
                  <small>{oppInfo.rating} ELO</small>
                </div>
              </div>
              <div className="race-metrics">
                <LivesIndicator lives={oppLives} maxLives={maxLives} />
                <strong className="race-percent opponent">{oppProgress}%</strong>
              </div>
            </div>
            <div className="race-progress-bar">
              <div
                className="race-progress-fill opponent"
                style={{ width: `${Math.min(100, oppProgress)}%` }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Khu vực bàn cờ chính + Bàn phím số */}
      <div className="play-layout">
        <div className="play-board-area">
          {isDuel && selectedRevealedWrong.length > 0 && (
            <div className="duel-revealed-wrong-banner" role="status">
              ⚠️ Số đã thử sai tại ô này: <strong>{selectedRevealedWrong.join(', ')}</strong>
            </div>
          )}

          <SudokuBoard
            initial={initialBoard}
            cells={cells}
            notes={notes}
            regionMap={regionMap}
            selected={selected}
            recentOpponentCell={recentOpponentCell}
            wrongCells={wrongCells}
            onSelect={handleSelectCell}
          />
        </div>

        <aside className="play-controls-area">
          <div className="multi-side-card">
            {isDuel ? (
              <>
                <div className="multi-side-card-head">
                  <h3>Nhật ký lượt đi (Duel)</h3>
                  <span>Lượt #{turnNumber}</span>
                </div>
                <p className="duel-scoring-rule-note">
                  Điền đúng: <b>+5</b> (Naked), <b>+10</b> (Hidden), <b>+8×ứng viên</b>{' '}
                  (Nâng cao). Điền sai: <b>-5 điểm</b> &amp; mất 1 mạng.
                </p>
                <div className="duel-move-feed">
                  {moveFeed.length === 0 ? (
                    <p className="duel-feed-empty">
                      Chưa có nước đi nào. Hãy chọn ô trống và điền số!
                    </p>
                  ) : (
                    moveFeed.map((item) => (
                      <div
                        key={item.id}
                        className={`duel-feed-item ${item.actor} ${item.ok ? 'ok' : 'err'}`}
                      >
                        <span>{item.text}</span>
                        {typeof item.points === 'number' && (
                          <strong>
                            {item.points > 0 ? `+${item.points}` : item.points}đ
                          </strong>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="multi-side-card-head">
                  <h3>Thống kê ván Race</h3>
                  <span>Lỗi: {myMistakes}/{maxLives}</span>
                </div>
                <p className="duel-scoring-rule-note">
                  Hoàn thành 81 ô nhanh nhất để chiến thắng. Mỗi lần điền sai mới trừ{' '}
                  <b>1 mạng</b> và cộng <b>+10 giây</b> phạt.
                </p>
              </>
            )}
          </div>

          <NumberPad
            cells={cells}
            notesMode={notesMode}
            showHint={false}
            onNumber={handleInputNumber}
            onDelete={handleDelete}
            onToggleNotes={handleToggleNotes}
            disabled={isDuel && !isMyTurn && !notesMode}
          />
        </aside>
      </div>

      {/* Modal xác nhận đầu hàng */}
      <Modal
        open={resignModalOpen}
        onClose={() => setResignModalOpen(false)}
        title="Xác nhận đầu hàng?"
      >
        <p style={{ margin: '0 0 16px', color: 'var(--muted)' }}>
          Nếu đầu hàng ngay bây giờ, bạn sẽ bị xử thua ván đấu này và bị trừ điểm Elo.
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setResignModalOpen(false)}
          >
            Tiếp tục thi đấu
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirmResign}
            disabled={isResigning}
          >
            🏳️ Chấp nhận đầu hàng
          </button>
        </div>
      </Modal>
    </div>
  )
}
