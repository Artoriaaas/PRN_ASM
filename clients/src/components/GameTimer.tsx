import { useState, useEffect, useRef } from 'react'

export type GameTimerProps = {
  /** Thời điểm bắt đầu (ms epoch). null = chưa bắt đầu */
  startedAt: number | null
  /** Deadline từ server (ms epoch). Dùng cho race/duel. null = đếm lên */
  serverDeadline?: number | null
  /** Callback khi hết giờ (serverDeadline mode) */
  onExpired?: () => void
  paused?: boolean
  className?: string
}

function formatTime(seconds: number): string {
  const absSeconds = Math.abs(seconds)
  const m = Math.floor(absSeconds / 60)
  const s = absSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * GameTimer — tách riêng khỏi component bàn cờ.
 * Mỗi giây re-render timer MÀ KHÔNG ép 81 ô re-render lại.
 */
export function GameTimer({
  startedAt,
  serverDeadline = null,
  onExpired,
  paused = false,
  className = '',
}: GameTimerProps) {
  const [now, setNow] = useState(() => Date.now())
  const onExpiredRef = useRef(onExpired)
  useEffect(() => {
    onExpiredRef.current = onExpired
  }, [onExpired])

  useEffect(() => {
    if (startedAt === null || paused) return

    const id = setInterval(() => {
      const currentNow = Date.now()
      setNow(currentNow)

      if (serverDeadline && currentNow >= serverDeadline) {
        clearInterval(id)
        onExpiredRef.current?.()
      }
    }, 1000)

    return () => clearInterval(id)
  }, [startedAt, serverDeadline, paused])

  if (startedAt === null) {
    return (
      <div className={`game-timer ${className}`} aria-live="off">
        <span className="timer-value">00:00</span>
      </div>
    )
  }

  let displaySeconds: number
  let isWarning = false

  if (serverDeadline) {
    const remaining = Math.max(0, Math.ceil((serverDeadline - now) / 1000))
    displaySeconds = remaining
    isWarning = remaining <= 60
  } else {
    displaySeconds = Math.floor((now - startedAt) / 1000)
  }

  return (
    <div
      className={`game-timer ${isWarning ? 'warning' : ''} ${className}`}
      aria-live="polite"
      aria-label={`Thời gian: ${formatTime(displaySeconds)}`}
    >
      <span className="timer-icon" aria-hidden="true">⏱</span>
      <span className="timer-value">{formatTime(displaySeconds)}</span>
    </div>
  )
}

