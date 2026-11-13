interface EmptyStateProps {
  title?: string
  description?: string
  icon?: string
}

export function EmptyState({
  title = 'Chưa có thông báo nào',
  description = 'Hoàn thành một bài học hoặc chơi một ván để nhận thông báo đầu tiên.',
  icon = '🔔',
}: EmptyStateProps) {
  return (
    <div className="notif-empty-state" role="status">
      <div className="notif-empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="notif-empty-title">{title}</h3>
      <p className="notif-empty-desc">{description}</p>
    </div>
  )
}

