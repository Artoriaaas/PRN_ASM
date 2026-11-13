import type { Lesson } from '../types'

export type LessonCardProps = {
  lesson: Lesson
  isUnlocked: boolean
  isCompleted: boolean
  isCurrent: boolean
  onClick: () => void
}

export function LessonCard({
  lesson,
  isUnlocked,
  isCompleted,
  isCurrent,
  onClick,
}: LessonCardProps) {
  const statusLabel = isCompleted
    ? 'Đã hoàn thành ✓'
    : isCurrent
    ? 'Đang học'
    : isUnlocked
    ? 'Chưa học'
    : 'Chưa mở khóa'

  const statusClass = isCompleted
    ? 'status-completed'
    : isCurrent
    ? 'status-current'
    : isUnlocked
    ? 'status-available'
    : 'status-locked'

  return (
    <button
      type="button"
      className={`lesson-list-item${!isUnlocked ? ' is-locked' : ''}${isCurrent ? ' is-current' : ''}${
        isCompleted ? ' is-completed' : ''
      }`}
      disabled={!isUnlocked}
      onClick={isUnlocked ? onClick : undefined}
      aria-label={`Bài ${lesson.order}: ${lesson.title}. Trạng thái: ${statusLabel}`}
    >
      <div className="item-left">
        <div
          className={`order-badge${isCompleted ? ' is-completed' : ''}${isCurrent ? ' is-current' : ''}`}
          aria-hidden="true"
        >
          {isCompleted ? '✓' : !isUnlocked ? '🔒' : lesson.order}
        </div>

        <div className="item-info">
          <div className="item-title-row">
            <span className="lesson-order-label">Bài {lesson.order}</span>
            <h3 className="item-title">{lesson.title}</h3>
          </div>
          <p className="item-summary">{lesson.summary}</p>
          <div className="item-meta">
            <span className="meta-time">⏱️ Khoảng {lesson.minutes} phút</span>
          </div>
        </div>
      </div>

      <div className="item-right">
        <span className={`status-pill ${statusClass}`}>
          {!isUnlocked && <span className="lock-icon" aria-hidden="true">🔒 </span>}
          {statusLabel}
        </span>

        <span className="action-pill">
          {isUnlocked ? (
            <span className="action-text">
              {isCompleted ? 'Ôn lại bài →' : isCurrent ? 'Tiếp tục →' : 'Bắt đầu học →'}
            </span>
          ) : (
            <span className="action-text text-muted">Bị khóa</span>
          )}
        </span>
      </div>
    </button>
  )
}
