import { useReducer, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { SudokuBoard } from '../../components/SudokuBoard'
import { NumberPad } from '../../components/NumberPad'
import { GameTimer } from '../../components/GameTimer'
import { Modal } from '../../components/ui/Modal'
import { STANDARD_REGION_MAP, toggleNote, isBoardFilled } from '../../lib/board'

// ─── Mock puzzle (thay bằng Game Service response) ───────────────────────────
const MOCK_INITIAL = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
const MOCK_REGION = STANDARD_REGION_MAP

// ─── State & Reducer ─────────────────────────────────────────────────────────
type SoloState = {
  cells: Uint8Array
  notes: Uint16Array
  selected: number | null
  notesMode: boolean
  mistakes: number
  hints: number
  paused: boolean
  startedAt: number | null
  finished: boolean
}

type SoloAction =
  | { type: 'SELECT'; index: number }
  | { type: 'INPUT'; value: number }
  | { type: 'DELETE' }
  | { type: 'TOGGLE_NOTES' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'HINT'; index: number; value: number }
  | { type: 'START'; startedAt: number }
  | { type: 'FINISH' }

function initState(): SoloState {
  const initial = MOCK_INITIAL
  const cells = new Uint8Array(81)
  for (let i = 0; i < 81; i++) {
    if (initial[i] !== '0') cells[i] = Number(initial[i])
  }
  return {
    cells,
    notes: new Uint16Array(81),
    selected: null,
    notesMode: false,
    mistakes: 0,
    hints: 0,
    paused: false,
    startedAt: null,
    finished: false,
  }
}

function soloReducer(state: SoloState, action: SoloAction): SoloState {
  switch (action.type) {
    case 'SELECT':
      return { ...state, selected: action.index }

    case 'START':
      return { ...state, startedAt: action.startedAt }

    case 'TOGGLE_PAUSE':
      return { ...state, paused: !state.paused }

    case 'TOGGLE_NOTES':
      return { ...state, notesMode: !state.notesMode }

    case 'FINISH':
      return { ...state, finished: true }

    case 'INPUT': {
      const { selected, notesMode } = state
      if (selected === null) return state
      if (MOCK_INITIAL[selected] !== '0') return state // ô đề, không sửa

      if (notesMode) {
        const nextNotes = new Uint16Array(state.notes)
        nextNotes[selected] = toggleNote(nextNotes[selected], action.value)
        return { ...state, notes: nextNotes }
      }

      const nextCells = new Uint8Array(state.cells)
      nextCells[selected] = action.value
      // Reset notes ô đó khi điền số
      const nextNotes = new Uint16Array(state.notes)
      nextNotes[selected] = 0

      const finished = isBoardFilled(nextCells)
      return { ...state, cells: nextCells, notes: nextNotes, finished }
    }

    case 'DELETE': {
      const { selected } = state
      if (selected === null) return state
      if (MOCK_INITIAL[selected] !== '0') return state

      const nextCells = new Uint8Array(state.cells)
      nextCells[selected] = 0
      const nextNotes = new Uint16Array(state.notes)
      nextNotes[selected] = 0
      return { ...state, cells: nextCells, notes: nextNotes }
    }

    case 'HINT': {
      const nextCells = new Uint8Array(state.cells)
      nextCells[action.index] = action.value
      return { ...state, cells: nextCells, hints: state.hints + 1 }
    }

    default:
      return state
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export function SoloPlayPage() {
  const { sessionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(soloReducer, undefined, initState)
  const [showQuitModal, setShowQuitModal] = useToggle(false)
  const startedRef = useRef(false)

  // Bắt đầu timer khi mount
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      dispatch({ type: 'START', startedAt: Date.now() })
    }
  }, [])

  // Khi bàn điền xong → chuyển sang kết quả
  useEffect(() => {
    if (state.finished) {
      navigate(`/solo/${sessionId}/result`, {
        state: {
          ...location.state,
          startedAt: state.startedAt,
          mistakes: state.mistakes,
          hints: state.hints,
        },
      })
    }
  }, [state.finished, navigate, sessionId, location.state, state.startedAt, state.mistakes, state.hints])

  // Phím tắt: N (ghi chú), H (gợi ý), Ctrl+Z (undo chưa có), 1-9, 0/Backspace/Delete
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (state.paused) return
      const { key, ctrlKey } = e

      if (key === 'n' || key === 'N') {
        dispatch({ type: 'TOGGLE_NOTES' })
        return
      }
      if (!ctrlKey && key >= '1' && key <= '9') {
        dispatch({ type: 'INPUT', value: Number(key) })
        return
      }
      if (key === '0' || key === 'Backspace' || key === 'Delete') {
        dispatch({ type: 'DELETE' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.paused])

  const layout = (location.state as { layout?: string })?.layout ?? 'standard'
  const level = (location.state as { level?: string })?.level ?? 'medium'

  return (
    <div className={`solo-play-page${state.paused ? ' is-paused' : ''}`}>
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
          <span className="meta-badge">{level === 'easy' ? 'Dễ' : level === 'medium' ? 'Trung bình' : level === 'hard' ? 'Khó' : 'Chuyên gia'}</span>
          <span className="meta-badge">{layout === 'standard' ? 'Standard' : 'Shuffle'}</span>
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
            initial={MOCK_INITIAL}
            cells={state.cells}
            notes={state.notes}
            regionMap={MOCK_REGION}
            selected={state.paused ? null : state.selected}
            onSelect={(i) => dispatch({ type: 'SELECT', index: i })}
            readOnly={state.paused}
          />
        </div>

        {/* Sidebar thông tin + NumberPad */}
        <aside className="game-sidebar">
          {/* Timer tách riêng — không ép board re-render */}
          <GameTimer
            startedAt={state.startedAt}
            paused={state.paused}
            className="sidebar-timer"
          />

          <div className="sidebar-stats">
            <div className="stat-row">
              <span>Lỗi</span>
              <strong>{state.mistakes}</strong>
            </div>
            <div className="stat-row">
              <span>Gợi ý</span>
              <strong>{state.hints}</strong>
            </div>
          </div>

          <NumberPad
            cells={state.cells}
            notesMode={state.notesMode}
            showHint={true}
            onNumber={(n) => dispatch({ type: 'INPUT', value: n })}
            onDelete={() => dispatch({ type: 'DELETE' })}
            onToggleNotes={() => dispatch({ type: 'TOGGLE_NOTES' })}
            disabled={state.paused}
          />
        </aside>
      </div>

      {/* Modal thoát */}
      <Modal
        open={showQuitModal}
        title="Thoát ván chơi?"
        onClose={() => setShowQuitModal(false)}
        footer={
          <div className="modal-footer-btns">
            <button type="button" className="btn btn-ghost" onClick={() => setShowQuitModal(false)}>
              Chơi tiếp
            </button>
            <button type="button" className="btn btn-danger" onClick={() => navigate('/home')}>
              Thoát
            </button>
          </div>
        }
      >
        <p>Tiến độ ván chơi sẽ không được lưu. Bạn có chắc muốn thoát?</p>
      </Modal>
    </div>
  )
}

// Hook nhỏ
function useToggle(initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useReducer((_: boolean, next: boolean) => next, initial)
  return [value, setValue]
}
