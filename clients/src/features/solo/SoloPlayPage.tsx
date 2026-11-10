import { useReducer, useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { SudokuBoard } from '../../components/SudokuBoard'
import { NumberPad } from '../../components/NumberPad'
import { GameTimer } from '../../components/GameTimer'
import { Modal } from '../../components/ui/Modal'
import { TutorialOverlay } from '../tutorial/TutorialOverlay'
import { CLASSIC_STEPS, SHUFFLE_STEPS } from '../tutorial/tutorialData'
import { useTutorialSteps, markTutorialDone } from '../tutorial/useTutorial'
import {
  STANDARD_REGION_MAP,
  toggleNote,
  isBoardFilled,
  indexToRC,
} from '../../lib/board'
import {
  makeGameMove,
  requestGameHint,
  abandonGameSession,
  getGameSession,
  SessionStatus,
  LayoutType,
} from '../../api/gameClient'
import {
  evaluateOfflineMove,
  getOfflineSolution,
  createOfflineSession,
} from '../../lib/offlineSudoku'
import type { SessionState } from '../../gen/sudoku/game/v1/game_pb'

type SoloState = {
  session: SessionState | null
  initialBoard: string
  regionMap: string
  cells: Uint8Array
  notes: Uint16Array
  selected: number | null
  notesMode: boolean
  mistakes: number
  maxMistakes: number
  hints: number
  maxHints: number
  score: number
  paused: boolean
  startedAt: number | null
  finished: boolean
  failed: boolean
  isOffline: boolean
  hintText: string | null
  wrongCells: Set<number>
  highlightCells: number[]
}
interface NavigationLocationState {
  session?: SessionState
  isOffline?: boolean
  level?: string
  layout?: string
  logicOnly?: boolean
  startedAt?: number
  mistakes?: number
  hints?: number
  score?: number
  /** 'classic' | 'shuffle' | null — tutorial mode được yêu cầu từ SoloSetupPage */
  tutorial?: 'classic' | 'shuffle' | null
}

type SoloAction =
  | { type: 'INIT_SESSION'; session: SessionState; isOffline: boolean }
  | { type: 'SELECT'; index: number }
  | { type: 'INPUT_OPTIMISTIC'; index: number; value: number }
  | { type: 'INPUT_NOTE'; index: number; value: number }
  | { type: 'MOVE_CORRECT'; index: number; value: number; score: number; isCompleted: boolean }
  | { type: 'MOVE_WRONG'; index: number; value: number; mistakes: number; isFailed: boolean }
  | { type: 'DELETE'; index: number }
  | { type: 'TOGGLE_NOTES' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'HINT'; index: number; value: number; text: string; highlightCells?: number[] }
  | { type: 'CLEAR_HINT_HIGHLIGHT' }
  | { type: 'FINISH' }
  | { type: 'FAIL' }
  | { type: 'SET_START_TIME'; startedAt: number }

function parseBoardString(boardStr: string): Uint8Array {
  const cells = new Uint8Array(81)
  for (let i = 0; i < 81; i++) {
    const ch = boardStr[i] ?? '0'
    if (ch >= '1' && ch <= '9') {
      cells[i] = Number(ch)
    }
  }
  return cells
}

function soloReducer(state: SoloState, action: SoloAction): SoloState {
  switch (action.type) {
    case 'INIT_SESSION': {
      const s = action.session
      const initial = s.initialBoard || s.currentBoard
      const cells = parseBoardString(s.currentBoard || initial)
      const notes = new Uint16Array(81)
      if (s.notes) {
        for (const n of s.notes) {
          if (n.cellIndex >= 0 && n.cellIndex < 81) {
            notes[n.cellIndex] = n.candidatesMask
          }
        }
      }

      return {
        ...state,
        session: s,
        initialBoard: initial,
        regionMap: s.regionMap || STANDARD_REGION_MAP,
        cells,
        notes,
        mistakes: s.mistakesCount,
        maxMistakes: s.maxMistakes || 3,
        hints: s.hintsUsed,
        maxHints: s.maxHints || 3,
        score: s.score,
        isOffline: action.isOffline,
        finished: s.status === SessionStatus.COMPLETED,
        failed: s.status === SessionStatus.FAILED,
        wrongCells: new Set<number>(),
      }
    }

    case 'SELECT':
      return { ...state, selected: action.index, hintText: null }

    case 'TOGGLE_PAUSE':
      return { ...state, paused: !state.paused }

    case 'TOGGLE_NOTES':
      return { ...state, notesMode: !state.notesMode }

    case 'INPUT_NOTE': {
      const nextNotes = new Uint16Array(state.notes)
      nextNotes[action.index] = toggleNote(nextNotes[action.index], action.value)
      return { ...state, notes: nextNotes }
    }

    case 'INPUT_OPTIMISTIC': {
      const nextCells = new Uint8Array(state.cells)
      nextCells[action.index] = action.value
      const nextNotes = new Uint16Array(state.notes)
      nextNotes[action.index] = 0
      const nextWrong = new Set(state.wrongCells)
      nextWrong.delete(action.index)
      return { ...state, cells: nextCells, notes: nextNotes, wrongCells: nextWrong }
    }

    case 'MOVE_CORRECT': {
      const nextCells = new Uint8Array(state.cells)
      nextCells[action.index] = action.value
      const nextWrong = new Set(state.wrongCells)
      nextWrong.delete(action.index)
      return {
        ...state,
        cells: nextCells,
        wrongCells: nextWrong,
        score: action.score,
        finished: action.isCompleted,
      }
    }

    case 'MOVE_WRONG': {
      const nextCells = new Uint8Array(state.cells)
      nextCells[action.index] = action.value // Vẫn hiển thị số sai người dùng vừa nhập
      const nextWrong = new Set(state.wrongCells)
      nextWrong.add(action.index) // Đánh dấu ô màu đỏ
      return {
        ...state,
        cells: nextCells,
        wrongCells: nextWrong,
        mistakes: action.mistakes,
        failed: action.isFailed,
      }
    }

    case 'DELETE': {
      const nextCells = new Uint8Array(state.cells)
      nextCells[action.index] = 0
      const nextNotes = new Uint16Array(state.notes)
      nextNotes[action.index] = 0
      const nextWrong = new Set(state.wrongCells)
      nextWrong.delete(action.index)
      return { ...state, cells: nextCells, notes: nextNotes, wrongCells: nextWrong }
    }

    case 'HINT': {
      const nextCells = new Uint8Array(state.cells)
      nextCells[action.index] = action.value
      const nextNotes = new Uint16Array(state.notes)
      nextNotes[action.index] = 0
      const nextWrong = new Set(state.wrongCells)
      nextWrong.delete(action.index)
      return {
        ...state,
        cells: nextCells,
        notes: nextNotes,
        wrongCells: nextWrong,
        hints: state.hints + 1,
        hintText: action.text,
        highlightCells: action.highlightCells ?? [action.index],
      }
    }

    case 'CLEAR_HINT_HIGHLIGHT':
      return { ...state, hintText: null, highlightCells: [] }

    case 'FINISH':
      return { ...state, finished: true }

    case 'FAIL':
      return { ...state, failed: true }
    case 'SET_START_TIME':
      return { ...state, startedAt: action.startedAt }

    default:
      return state
  }
}

export function SoloPlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const location = useLocation()
  const navigate = useNavigate()

  const [state, dispatch] = useReducer(soloReducer, {
    session: null,
    initialBoard: STANDARD_REGION_MAP,
    regionMap: STANDARD_REGION_MAP,
    cells: new Uint8Array(81),
    notes: new Uint16Array(81),
    selected: null,
    notesMode: false,
    mistakes: 0,
    maxMistakes: 3,
    hints: 0,
    maxHints: 3,
    score: 0,
    paused: false,
    startedAt: null,
    finished: false,
    failed: false,
    isOffline: false,
    hintText: null,
    highlightCells: [],
    wrongCells: new Set<number>(),
  })

  const [showQuitModal, setShowQuitModal] = useState(false)
  const isSubmittingMove = useRef(false)
  const isRequestingHint = useRef(false)

  // ── Tutorial state ──────────────────────────────────────────────────────────
  const locState = location.state as NavigationLocationState | null
  const tutorialMode = locState?.tutorial ?? null

  // Chọn bộ bước tutorial theo mode
  const tutorialSteps = tutorialMode === 'shuffle' ? SHUFFLE_STEPS : CLASSIC_STEPS
  const {
    step: tutStep,
    completed: tutCompleted,
    goNext: tutNext,
    goPrev: tutPrev,
  } = useTutorialSteps(tutorialSteps.length)

  const [tutorialActive, setTutorialActive] = useState(Boolean(tutorialMode))
  const [tutorialDismissed, setTutorialDismissed] = useState(false)

  // Khi tutorial hoàn thành (bước cuối) hoặc bị skip
  const handleTutorialComplete = useCallback(() => {
    if (tutorialMode === 'classic' || tutorialMode === 'shuffle') {
      markTutorialDone(tutorialMode)
    }
    setTutorialActive(false)
    setTutorialDismissed(true)
  }, [tutorialMode])

  const handleTutorialSkip = useCallback(() => {
    if (tutorialMode === 'classic' || tutorialMode === 'shuffle') {
      markTutorialDone(tutorialMode)
    }
    setTutorialActive(false)
    setTutorialDismissed(true)
  }, [tutorialMode])

  // Khi tutorial hoàn thành tự động từ hook
  useEffect(() => {
    if (tutCompleted && tutorialActive) {
      handleTutorialComplete()
    }
  }, [tutCompleted, tutorialActive, handleTutorialComplete])

  // Tutorial: chọn ô trên bàn cờ theo step
  const handleTutorialSelectCell = useCallback((index: number | null) => {
    if (index !== null) {
      dispatch({ type: 'SELECT', index })
    }
  }, [])

  // Tutorial pause: tutorial active → ẩn quit, block keyboard (ngoài tutorial)
  const isTutorialShowing = tutorialActive && !tutorialDismissed
  // ── End Tutorial state ──────────────────────────────────────────────────────

  // Khởi tạo session từ navigation state hoặc tải từ server
  useEffect(() => {
    const locState = location.state as NavigationLocationState | null

    if (locState?.session) {
      dispatch({
        type: 'INIT_SESSION',
        session: locState.session,
        isOffline: Boolean(locState.isOffline),
      })
      return
    }

    if (!sessionId) return
    const layoutType =
      locState?.layout === 'irregular' || locState?.session?.layoutType === LayoutType.IRREGULAR
        ? LayoutType.IRREGULAR
        : LayoutType.STANDARD

    if (sessionId.startsWith('offline-')) {
      const level = locState?.level ?? 'medium'
      const offline = createOfflineSession(level, layoutType)
      dispatch({ type: 'INIT_SESSION', session: offline, isOffline: true })
      return
    }

    // Tải từ backend
    const controller = new AbortController()
    getGameSession(sessionId, controller.signal)
      .then((s) => {
        dispatch({ type: 'INIT_SESSION', session: s, isOffline: false })
      })
      .catch((err) => {
        console.warn('Failed to load session, falling back to offline:', err)
        const offline = createOfflineSession(locState?.level ?? 'medium', layoutType)
        dispatch({ type: 'INIT_SESSION', session: offline, isOffline: true })
      })
    return () => controller.abort()
  }, [sessionId, location.state])

  // Timer started
  useEffect(() => {
    if (state.session && !state.startedAt) {
      dispatch({ type: 'SET_START_TIME', startedAt: Date.now() })
    }
  }, [state.session, state.startedAt])

  // Điều hướng khi thắng
  useEffect(() => {
    if (state.finished && sessionId) {
      navigate(`/solo/${sessionId}/result`, {
        state: {
          ...location.state,
          startedAt: state.startedAt,
          mistakes: state.mistakes,
          hints: state.hints,
          score: state.score,
        },
      })
    }
  }, [state.finished, navigate, sessionId, location.state, state.startedAt, state.mistakes, state.hints, state.score])

  // Xử lý điền số
  async function handleInput(value: number) {
    const { selected, notesMode, initialBoard, isOffline, session } = state
    if (selected === null || !session) return
    if (initialBoard[selected] !== '0') return // ô đề gốc

    if (notesMode) {
      dispatch({ type: 'INPUT_NOTE', index: selected, value })
      return
    }

    if (isSubmittingMove.current) return
    isSubmittingMove.current = true

    // Optimistic UI: hiển thị số ngay tức thì
    dispatch({ type: 'INPUT_OPTIMISTIC', index: selected, value })

    const [row, col] = indexToRC(selected)

    try {
      if (isOffline) {
        const evalRes = evaluateOfflineMove(session, row, col, value)
        if (evalRes.isCorrect) {
          const nextCells = new Uint8Array(state.cells)
          nextCells[selected] = value
          const completed = isBoardFilled(nextCells)
          dispatch({
            type: 'MOVE_CORRECT',
            index: selected,
            value,
            score: state.score + evalRes.pointsDelta,
            isCompleted: completed,
          })
        } else {
          const nextMistakes = state.mistakes + 1
          dispatch({
            type: 'MOVE_WRONG',
            index: selected,
            value,
            mistakes: nextMistakes,
            isFailed: nextMistakes >= state.maxMistakes,
          })
        }
      } else {
        const res = await makeGameMove(session.sessionId, row, col, value)
        if (res.isCorrect) {
          const isCompleted = res.session?.status === SessionStatus.COMPLETED || isBoardFilled(state.cells)
          dispatch({
            type: 'MOVE_CORRECT',
            index: selected,
            value,
            score: res.session?.score ?? state.score + res.pointsDelta,
            isCompleted,
          })
        } else {
          const mistakesCount = res.session?.mistakesCount ?? state.mistakes + 1
          const isFailed = res.session?.status === SessionStatus.FAILED || mistakesCount >= state.maxMistakes
          dispatch({
            type: 'MOVE_WRONG',
            index: selected,
            value,
            mistakes: mistakesCount,
            isFailed,
          })
        }
      }
    } catch (err) {
      console.error('MakeMove error:', err)
    } finally {
      isSubmittingMove.current = false
    }
  }

  // Xóa ô
  function handleDelete() {
    const { selected, initialBoard } = state
    if (selected === null) return
    if (initialBoard[selected] !== '0') return
    dispatch({ type: 'DELETE', index: selected })
  }

  // Yêu cầu gợi ý
  async function handleHint() {
    const { session, isOffline, selected, hints, maxHints } = state
    if (!session || hints >= maxHints || isRequestingHint.current) return
    isRequestingHint.current = true

    try {
      if (isOffline) {
        const solution = getOfflineSolution(session.sessionId)
        if (!solution) return

        let targetIdx = selected
        if (targetIdx === null || state.initialBoard[targetIdx] !== '0' || state.cells[targetIdx] !== 0) {
          const emptyIndices: number[] = []
          for (let i = 0; i < 81; i++) {
            if (state.initialBoard[i] === '0' && state.cells[i] === 0) {
              emptyIndices.push(i)
            }
          }
          if (emptyIndices.length === 0) return
          targetIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)]
        }

        const hintVal = Number(solution[targetIdx])
        dispatch({
          type: 'HINT',
          index: targetIdx,
          value: hintVal,
          text: `Gợi ý: Ô (${Math.floor(targetIdx / 9) + 1}, ${(targetIdx % 9) + 1}) là số ${hintVal}`,
        })
      } else {
        const [targetRow, targetCol] = selected !== null ? indexToRC(selected) : [undefined, undefined]
        const res = await requestGameHint(session.sessionId, targetRow, targetCol)
        const cellIdx = res.row * 9 + res.col
        dispatch({
          type: 'HINT',
          index: cellIdx,
          value: res.value,
          text: `Gợi ý [${res.technique}]: Ô (${res.row + 1}, ${res.col + 1}) là số ${res.value}`,
          highlightCells: res.highlightCells,
        })
      }
    } catch (err) {
      console.warn('Hint request failed:', err)
    } finally {
      isRequestingHint.current = false
    }
  }

  // Thoát ván
  async function handleQuit() {
    if (state.session && !state.isOffline) {
      try {
        await abandonGameSession(state.session.sessionId)
      } catch {
        // bỏ qua lỗi abandon
      }
    }
    navigate('/home')
  }

  // Phím tắt
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (state.paused) return
      // Khi tutorial đang hiện → chỉ cho phép mũi tên điều hướng ô
      if (isTutorialShowing) {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      }
      const { key, ctrlKey } = e

      if (key === 'n' || key === 'N') {
        dispatch({ type: 'TOGGLE_NOTES' })
        return
      }
      if (key === 'h' || key === 'H') {
        void handleHint()
        return
      }
      if (!ctrlKey && key >= '1' && key <= '9') {
        void handleInput(Number(key))
        return
      }
      if (key === '0' || key === 'Backspace' || key === 'Delete') {
        handleDelete()
        return
      }

      // Mũi tên điều hướng
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        e.preventDefault()
        const cur = state.selected ?? 0
        const r = Math.floor(cur / 9)
        const c = cur % 9
        let next = cur
        if (key === 'ArrowUp') next = Math.max(0, r - 1) * 9 + c
        if (key === 'ArrowDown') next = Math.min(8, r + 1) * 9 + c
        if (key === 'ArrowLeft') next = r * 9 + Math.max(0, c - 1)
        if (key === 'ArrowRight') next = r * 9 + Math.min(8, c + 1)
        dispatch({ type: 'SELECT', index: next })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.paused, state.selected, state.notesMode, state.initialBoard, state.cells, isTutorialShowing])

  const layout = locState?.layout ?? 'standard'
  const level = locState?.level ?? 'medium'

  return (
    <div className={`solo-play-page${state.paused ? ' is-paused' : ''}${isTutorialShowing ? ' tutorial-mode' : ''}`}>
      {/* Topbar */}
      <div className="game-topbar">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setShowQuitModal(true)}
          aria-label="Thoát ván chơi"
        >
          ← Thoát
        </button>

        <div className="game-meta" aria-label="Thông tin ván">
          <span className="meta-badge">
            {level === 'easy'
              ? 'Dễ'
              : level === 'medium'
              ? 'Trung bình'
              : level === 'hard'
              ? 'Khó'
              : 'Chuyên gia'}
          </span>
          <span className="meta-badge">
            {layout === 'standard' ? 'Standard' : 'Shuffle'}
          </span>
          {state.isOffline && <span className="meta-badge badge-offline">Offline</span>}
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
          aria-label={state.paused ? 'Tiếp tục' : 'Tạm dừng'}
        >
          {state.paused ? '▶' : '⏸'}
        </button>
      </div>

      {state.hintText && (
        <div className="hint-banner" role="status">
          <span>💡 {state.hintText}</span>
          <button
            type="button"
            className="hint-close-btn"
            onClick={() => dispatch({ type: 'CLEAR_HINT_HIGHLIGHT' })}
          >
            ✕
          </button>
        </div>
      )}

      {/* Layout chính */}
      <div className="game-layout">
        {/* Bàn cờ */}
        <div className="game-board-wrap">
          {state.paused && (
            <div className="pause-overlay">
              <p>⏸ Đang tạm dừng</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })}
              >
                Tiếp tục
              </button>
            </div>
          )}
          <SudokuBoard
            initial={state.initialBoard}
            cells={state.cells}
            notes={state.notes}
            regionMap={state.regionMap}
            selected={state.paused ? null : state.selected}
            wrongCells={state.wrongCells}
            onSelect={(i) => dispatch({ type: 'SELECT', index: i })}
          />
        </div>

        {/* Sidebar thông tin + NumberPad */}
        <aside className="game-sidebar">
          <GameTimer
            startedAt={state.startedAt}
            paused={state.paused}
            className="sidebar-timer"
          />

          <div className="sidebar-stats">
            <div className="stat-row">
              <span>Lỗi</span>
              <strong className={state.mistakes > 0 ? 'text-danger' : ''}>
                {state.mistakes} / {state.maxMistakes}
              </strong>
            </div>
            <div className="stat-row">
              <span>Gợi ý</span>
              <strong>
                {state.hints} / {state.maxHints}
              </strong>
            </div>
            <div className="stat-row">
              <span>Điểm</span>
              <strong>{state.score}</strong>
            </div>
          </div>

          <NumberPad
            cells={state.cells}
            notesMode={state.notesMode}
            showHint={true}
            onNumber={(n) => void handleInput(n)}
            onDelete={handleDelete}
            onToggleNotes={() => dispatch({ type: 'TOGGLE_NOTES' })}
            onHint={() => void handleHint()}
            disabled={state.paused}
          />
        </aside>
      </div>

      {/* Modal thất bại / Hết mạng */}
      <Modal
        open={state.failed}
        title="Thua cuộc!"
        onClose={() => navigate('/home')}
        footer={
          <div className="modal-footer-btns">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/solo/new', { state: { layout, level } })}
            >
              Chơi lại
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate('/home')}
            >
              Về trang chủ
            </button>
          </div>
        }
      >
        <p>Bạn đã mắc {state.mistakes} lỗi (vượt quá giới hạn {state.maxMistakes} lỗi).</p>
        <p>Đừng nản lòng, hãy thử lại ván mới nhé!</p>
      </Modal>

      {/* Modal thoát */}
      <Modal
        open={showQuitModal}
        title="Thoát ván chơi?"
        onClose={() => setShowQuitModal(false)}
        footer={
          <div className="modal-footer-btns">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowQuitModal(false)}
            >
              Chơi tiếp
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void handleQuit()}
            >
              Thoát
            </button>
          </div>
        }
      >
        <p>Tiến độ ván chơi hiện tại sẽ bị hủy. Bạn có chắc muốn thoát?</p>
      </Modal>

      {/* Tutorial Overlay — hiển thị khi tutorial active */}
      {isTutorialShowing && state.session && (
        <TutorialOverlay
          steps={tutorialSteps}
          currentStep={tutStep}
          totalSteps={tutorialSteps.length}
          onNext={tutNext}
          onPrev={tutPrev}
          onSkip={handleTutorialSkip}
          onComplete={handleTutorialComplete}
          onSelectCell={handleTutorialSelectCell}
          onToggleNotes={() => dispatch({ type: 'TOGGLE_NOTES' })}
          onRequestHint={() => void handleHint()}
        />
      )}
    </div>
  )
}
