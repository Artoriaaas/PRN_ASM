import { type ReactNode } from 'react'

type SkeletonProps = { className?: string; width?: string; height?: string }

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

type EmptyStateProps = {
  icon?: string
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon = '◇', title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

type ErrorStateProps = {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorState({ title = 'Đã xảy ra lỗi', message, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <span className="empty-icon" aria-hidden="true">⚠</span>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  )
}

