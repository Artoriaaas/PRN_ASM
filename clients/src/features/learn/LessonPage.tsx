import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { LESSONS } from './lessons'
import { useLessonProgress } from './useLessonProgress'
import type { Highlight, Step } from './types'
import { SudokuBoard } from './components/SudokuBoard'
import { NumberPad } from './components/NumberPad'
import { StepExplain } from './components/StepExplain'
import { StepExercise } from './components/StepExercise'
import { STANDARD_REGION_MAP } from '../../lib/board'
import './learn.css'

type LessonStepViewProps = {
  step: Step
  stepIndex: number
  totalSteps: number
  onNextStep: () => void
  onPrevStep: () => void
}

function LessonStepView({
  step,
  stepIndex,
  totalSteps,
  onNextStep,
  onPrevStep,
}: LessonStepViewProps) {
  const initialBoardCells = step.board?.cells || Array(81).fill('.').join('')
  const initialMask = Array.from(initialBoardCells).map((c) => c !== '.' && c !== '0')

  // Trạng thái bàn cờ khởi tạo trực tiếp theo bước
  const [currentCells, setCurrentCells] = useState<string>(initialBoardCells)
  const [givenMask] = useState<boolean[]>(initialMask)
  const [selectedCell, setSelectedCell] = useState<number | null>(() => {
    if (step.kind === 'exercise') {
      if (step.task.type === 'fill-cell') {
        const firstTarget = Object.keys(step.task.answers).map(Number)[0]
        return firstTarget ?? null
      }
      if (step.task.type === 'pick-candidates') {
        return step.task.cell
      }
    }
    return null
  })
  const [userCandidates, setUserCandidates] = useState<Record<number, number[]>>(
    () => step.board?.candidates || {},
  )
  const [isNoteMode, setIsNoteMode] = useState(false)

  // Trạng thái bài tập khởi tạo trực tiếp
  const [isSolved, setIsSolved] = useState(step.kind === 'explain')
  const [wrongCount, setWrongCount] = useState(0)
  const [lastError, setLastError] = useState<string | null>(null)
  const [currentHintIndex, setCurrentHintIndex] = useState(-1)
  const [shakeCell, setShakeCell] = useState<number | null>(null)
  const [eliminatedCells, setEliminatedCells] = useState<Set<number>>(new Set())

  // Kích hoạt hiệu ứng rung lắc ô khi thao tác sai
  const triggerShake = useCallback((cellIdx: number, message: string) => {
    setShakeCell(cellIdx)
    setWrongCount((prev) => prev + 1)
    setLastError(message)
    setTimeout(() => {
      setShakeCell(null)
    }, 400)
  }, [])

  // Xử lý khi bấm vào 1 ô trên bàn cờ
  const handleCellClick = (idx: number) => {
    setSelectedCell(idx)

    if (isSolved || step.kind !== 'exercise') return

    const { task } = step

    if (task.type === 'pick-cell') {
      if (idx === task.correctCell) {
        setIsSolved(true)
        setLastError(null)
      } else {
        triggerShake(idx, 'Chưa đúng vị trí yêu cầu. Hãy quan sát kỹ lại!')
      }
    } else if (task.type === 'eliminate') {
      if (task.blockedCells.includes(idx)) {
        const next = new Set(eliminatedCells)
        next.add(idx)
        setEliminatedCells(next)
        if (next.size >= task.blockedCells.length) {
          setIsSolved(true)
          setLastError(null)
        }
      } else {
        triggerShake(idx, `Ô này không bị chặn bởi số ${task.number}!`)
      }
    }
  }

  // Xử lý nhập số từ Numpad hoặc bàn phím
  const handleDigitInput = (digit: number) => {
    if (selectedCell === null || isSolved || step.kind !== 'exercise') return

    const { task } = step

    if (isNoteMode) {
      // Chế độ ghi chú
      const currentList = userCandidates[selectedCell] || []
      const nextList = currentList.includes(digit)
        ? currentList.filter((d) => d !== digit)
        : [...currentList, digit].sort((a, b) => a - b)

      const nextCandidates = { ...userCandidates, [selectedCell]: nextList }
      setUserCandidates(nextCandidates)

      // Kiểm tra task pick-candidates
      if (task.type === 'pick-candidates' && selectedCell === task.cell) {
        const sortedExpected = [...task.correct].sort((a, b) => a - b)
        const isMatch =
          nextList.length === sortedExpected.length &&
          nextList.every((v, i) => v === sortedExpected[i])

        if (isMatch) {
          setIsSolved(true)
          setLastError(null)
        }
      }
      return
    }

    // Chế độ điền số chính thức
    if (givenMask[selectedCell]) {
      return // Không được ghi đè số đề cho
    }

    if (task.type === 'fill-cell') {
      const expected = task.answers[selectedCell]
      if (expected === digit) {
        // Điền đúng!
        const chars = currentCells.split('')
        chars[selectedCell] = String(digit)
        const nextBoard = chars.join('')
        setCurrentCells(nextBoard)
        setLastError(null)

        // Kiểm tra xem đã điền hết các ô yêu cầu chưa
        const allFilled = Object.entries(task.answers).every(
          ([cIdx, expectedVal]) => chars[Number(cIdx)] === String(expectedVal),
        )
        if (allFilled) {
          setIsSolved(true)
        }
      } else {
        triggerShake(selectedCell, 'Số này chưa chính xác theo logic bài học. Thử lại!')
      }
    }
  }

  // Xử lý nút xóa
  const handleErase = () => {
    if (selectedCell === null || isSolved || givenMask[selectedCell]) return

    if (isNoteMode) {
      const next = { ...userCandidates }
      delete next[selectedCell]
      setUserCandidates(next)
    } else {
      const chars = currentCells.split('')
      chars[selectedCell] = '.'
      setCurrentCells(chars.join(''))
    }
  }

  // Xử lý xem đáp án (sau 3 lần sai)
  const handleRevealAnswer = () => {
    if (step.kind !== 'exercise') return
    const { task } = step

    if (task.type === 'fill-cell') {
      const chars = currentCells.split('')
      for (const [c, ans] of Object.entries(task.answers)) {
        chars[Number(c)] = String(ans)
      }
      setCurrentCells(chars.join(''))
      setIsSolved(true)
    } else if (task.type === 'pick-cell') {
      setSelectedCell(task.correctCell)
      setIsSolved(true)
    } else if (task.type === 'pick-candidates') {
      setUserCandidates({ ...userCandidates, [task.cell]: task.correct })
      setIsSolved(true)
    } else if (task.type === 'eliminate') {
      setEliminatedCells(new Set(task.blockedCells))
      setIsSolved(true)
    }
  }

  // Tổng hợp các highlights hiển thị trên bàn cờ
  const activeHighlights = useMemo<Highlight[]>(() => {
    const list: Highlight[] = []
    if (step.kind === 'explain' && step.highlights) {
      list.push(...step.highlights)
    }

    if (step.kind === 'exercise') {
      const { task } = step
      if (task.type === 'eliminate') {
        if (eliminatedCells.size > 0) {
          list.push({
            type: 'cell',
            targets: Array.from(eliminatedCells),
            tone: 'block',
          })
        }
      } else if (task.type === 'fill-cell') {
        const targets = Object.keys(task.answers).map(Number)
        list.push({
          type: 'cell',
          targets,
          tone: isSolved ? 'focus' : 'target',
        })
      } else if (task.type === 'pick-candidates') {
        list.push({
          type: 'cell',
          targets: [task.cell],
          tone: isSolved ? 'focus' : 'target',
        })
      }
    }

    // Nếu người dùng yêu cầu gợi ý cuối cùng -> tô sáng ô đích
    if (step.kind === 'exercise' && currentHintIndex >= step.hints.length - 1) {
      const { task } = step
      if (task.type === 'pick-cell') {
        list.push({ type: 'cell', targets: [task.correctCell], tone: 'target' })
      }
    }

    return list
  }, [step, eliminatedCells, isSolved, currentHintIndex])

  const isShuffle = step.board?.regions !== undefined

  return (
    <main className="lesson-stage-layout">
      <div className="lesson-board-pane">
        <SudokuBoard
          cells={currentCells}
          givenMask={givenMask}
          regions={step.board?.regions || STANDARD_REGION_MAP}
          highlights={activeHighlights}
          candidates={userCandidates}
          selectedCell={selectedCell}
          shakeCell={shakeCell}
          mode={isNoteMode ? 'notes' : 'fill'}
          onCellSelect={handleCellClick}
        />

        <NumberPad
          disabled={isSolved && step.kind === 'explain'}
          isNoteMode={isNoteMode}
          showNoteToggle={!isShuffle}
          onInput={handleDigitInput}
          onErase={handleErase}
          onToggleNoteMode={() => setIsNoteMode((prev) => !prev)}
        />
      </div>

      <div className="lesson-content-pane">
        {step.kind === 'explain' ? (
          <StepExplain
            title={step.title}
            body={step.body}
            canGoBack={stepIndex > 0}
            canGoNext={true}
            isLastStep={stepIndex === totalSteps - 1}
            onNext={onNextStep}
            onPrev={onPrevStep}
          />
        ) : (
          <StepExercise
            title={step.title}
            prompt={step.prompt}
            task={step.task}
            hints={step.hints}
            successMessage={step.successMessage}
            answerExplanation={step.answerExplanation}
            isSolved={isSolved}
            wrongCount={wrongCount}
            lastError={lastError}
            currentHintIndex={currentHintIndex}
            canGoBack={stepIndex > 0}
            isLastStep={stepIndex === totalSteps - 1}
            onNext={onNextStep}
            onPrev={onPrevStep}
            onShowNextHint={() => {
              if (currentHintIndex < step.hints.length - 1) {
                setCurrentHintIndex((prev) => prev + 1)
              }
            }}
            onRevealAnswer={handleRevealAnswer}
          />
        )}
      </div>
    </main>
  )
}

export function LessonPage() {
  const { lessonCode } = useParams<{ lessonCode: string }>()
  const navigate = useNavigate()
  const { isUnlocked, complete, nextLesson } = useLessonProgress()

  const lesson = useMemo(() => {
    return LESSONS.find((l) => l.code === lessonCode) || null
  }, [lessonCode])

  const [stepIndex, setStepIndex] = useState(0)
  const [isCompletedView, setIsCompletedView] = useState(false)

  if (!lesson) {
    return (
      <div className="learn-container">
        <div className="coming-soon">
          <p className="eyebrow">KHÔNG TÌM THẤY</p>
          <h2>Bài học không tồn tại</h2>
          <p>Mã bài học "{lessonCode}" không hợp lệ hoặc đã được cập nhật.</p>
          <div style={{ marginTop: 20 }}>
            <Link to="/learn" className="btn-continue-learn">
              ← Về danh sách bài học
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const unlocked = isUnlocked(lesson.code)
  if (!unlocked) {
    return (
      <div className="learn-container">
        <div className="coming-soon">
          <p className="eyebrow">CHƯA MỞ KHÓA</p>
          <h2>Bài học này đang bị khóa</h2>
          <p>
            Bạn cần hoàn thành bài học trước đó để mở khóa <strong>Bài {lesson.order}: {lesson.title}</strong>.
          </p>
          <div style={{ marginTop: 20 }}>
            <Link to="/learn" className="btn-continue-learn">
              ← Về danh sách bài học
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const totalSteps = lesson.steps.length
  const currentStep = lesson.steps[stepIndex]

  // Chuyển sang bước tiếp theo
  const handleNextStep = () => {
    if (stepIndex < totalSteps - 1) {
      setStepIndex((prev) => prev + 1)
    } else {
      // Đã xong bước cuối -> Đánh dấu hoàn thành bài học
      void complete(lesson.code)
      setIsCompletedView(true)
    }
  }

  // Quay lại bước trước
  const handlePrevStep = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1)
    }
  }

  // Màn hình hoàn thành bài học
  if (isCompletedView) {
    return (
      <div className="lesson-page-container">
        <div className="lesson-completion-view">
          <div className="completion-trophy" aria-hidden="true">🎉</div>
          <h2 className="completion-title">Hoàn thành xuất sắc!</h2>
          <p className="completion-desc">
            Bạn đã hoàn thành <strong>Bài {lesson.order}: {lesson.title}</strong>. Kỹ thuật này sẽ
            là hành trang quan trọng để bạn giải các ván Sudoku một cách tự tin.
          </p>

          <div className="completion-actions">
            {nextLesson ? (
              <button
                type="button"
                className="btn-completion-next"
                onClick={() => {
                  navigate(`/learn/${nextLesson.code}`)
                  setStepIndex(0)
                  setIsCompletedView(false)
                }}
              >
                <span>Học bài tiếp theo: Bài {nextLesson.order} →</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn-completion-next"
                onClick={() => navigate('/solo/new')}
              >
                <span>🎮 Bắt đầu chơi ván đầu tiên</span>
              </button>
            )}

            <button
              type="button"
              className="btn-completion-retry"
              onClick={() => {
                setStepIndex(0)
                setIsCompletedView(false)
              }}
            >
              Làm lại bài này ↺
            </button>

            <button
              type="button"
              className="btn-completion-list"
              onClick={() => navigate('/learn')}
            >
              Về danh sách bài học
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="lesson-page-container">
      {/* Thanh trên: Nút quay lại, tên bài, chỉ báo bước */}
      <header className="lesson-topbar">
        <Link to="/learn" className="lesson-back-link" aria-label="Quay lại danh sách bài học">
          <span>← Danh sách bài</span>
        </Link>

        <div className="lesson-heading">
          <div className="lesson-super-title">Bài {lesson.order}</div>
          <h1 className="lesson-main-heading">{lesson.title}</h1>
        </div>

        <div className="lesson-step-indicator" aria-label={`Bước ${stepIndex + 1} trên tổng số ${totalSteps} bước`}>
          Bước {stepIndex + 1}/{totalSteps}
        </div>
      </header>

      {/* Thanh tiến độ từng bước */}
      <div className="lesson-step-progressbar" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={totalSteps}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`step-pip${i < stepIndex ? ' is-completed' : i === stepIndex ? ' is-current' : ''}`}
          />
        ))}
      </div>

      {/* Render bước hiện tại với key độc nhất để khởi tạo lại state sạch sẽ */}
      <LessonStepView
        key={`${lesson.code}-step-${stepIndex}`}
        step={currentStep}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        onNextStep={handleNextStep}
        onPrevStep={handlePrevStep}
      />
    </div>
  )
}
