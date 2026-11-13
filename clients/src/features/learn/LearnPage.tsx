import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LESSONS } from './lessons'
import { useLessonProgress } from './useLessonProgress'
import { LessonCard } from './components/LessonCard'
import { validateLessons } from './validateLessons'
import './learn.css'

export function LearnPage() {
  const navigate = useNavigate()
  const {
    loading,
    completedCodes,
    isUnlocked,
    nextLesson,
    allCompleted,
    totalCount,
    completedCount,
    reset,
  } = useLessonProgress()

  // Kiểm tra tính hợp lệ của toàn bộ bài học ở chế độ DEV
  useEffect(() => {
    if (import.meta.env.DEV) {
      const res = validateLessons(LESSONS)
      if (!res.valid) {
        console.error('Lỗi kiểm tra bài học Sudoku:', res.errors)
      } else {
        console.info('Toàn bộ 7 bài học Sudoku đã được xác thực hợp lệ 100%.')
      }
    }
  }, [])

  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="learn-container">
      {/* Tiêu đề & mô tả */}
      <header className="learn-header">
        <div className="learn-breadcrumbs">Khóa học tương tác</div>
        <h1 className="learn-main-title">Học kỹ thuật</h1>
        <p className="learn-description">
          Hoàn thành 7 bài học ngắn để tự tin chơi được Sudoku cơ bản và biến thể Shuffle
        </p>
      </header>

      {/* Thông điệp chúc mừng khi hoàn thành trọn bộ */}
      {allCompleted && (
        <div className="congrats-banner" role="status">
          <div className="congrats-icon" aria-hidden="true">🏆</div>
          <div className="congrats-text">
            <h3>Chúc mừng! Bạn đã hoàn thành toàn bộ khóa học</h3>
            <p>
              Bạn đã nắm vững các kỹ thuật từ cơ bản đến nâng cao. Giờ là lúc thử thách bản thân
              trong một ván đấu thực sự!
            </p>
          </div>
        </div>
      )}

      {/* Thẻ tiến độ tổng quan */}
      <section className="learn-overview-card" aria-label="Tiến độ học tập">
        <div className="overview-top">
          <span className="overview-title">Tiến độ của bạn</span>
          <span className="overview-stats">
            {loading ? 'Đang tải…' : `Đã hoàn thành ${completedCount}/${totalCount} bài (${percent}%)`}
          </span>
        </div>

        <div className="progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>

        <div className="overview-actions">
          <div className="overview-actions-btns">
            {allCompleted ? (
              <button
                type="button"
                className="btn-continue-learn"
                onClick={() => navigate('/solo/new')}
              >
                <span>🎮 Chơi ván đầu tiên</span>
              </button>
            ) : nextLesson ? (
              <button
                type="button"
                className="btn-continue-learn"
                onClick={() => navigate(`/learn/${nextLesson.code}`)}
              >
                <span>👉 Tiếp tục học: Bài {nextLesson.order} - {nextLesson.title}</span>
              </button>
            ) : null}

            {completedCount > 0 && (
              <button
                type="button"
                className="btn-reset-learn"
                onClick={() => {
                  if (window.confirm('Bạn có chắc muốn đặt lại toàn bộ tiến độ học tập để học lại từ đầu?')) {
                    void reset()
                  }
                }}
              >
                Đặt lại tiến độ
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Danh sách 7 bài học dạng List */}
      <section className="lessons-list" aria-label="Danh sách các bài học">
        {LESSONS.map((lesson) => {
          const unlocked = isUnlocked(lesson.code)
          const completed = completedCodes.has(lesson.code)
          const isCurrent = nextLesson?.code === lesson.code

          return (
            <LessonCard
              key={lesson.code}
              lesson={lesson}
              isUnlocked={unlocked}
              isCompleted={completed}
              isCurrent={isCurrent}
              onClick={() => navigate(`/learn/${lesson.code}`)}
            />
          )
        })}
      </section>
    </div>
  )
}

