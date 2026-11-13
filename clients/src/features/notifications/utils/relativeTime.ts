/**
 * Định dạng thời gian tương đối tiếng Việt chuẩn:
 * - < 1 phút: "vừa xong"
 * - < 60 phút: "X phút trước"
 * - < 24 giờ: "X giờ trước"
 * - 1 ngày: "Hôm qua"
 * - 2-6 ngày: "X ngày trước"
 * - >= 7 ngày: ngày đầy đủ "DD/MM/YYYY"
 */
export function formatRelativeTimeVi(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  // Trường hợp thời gian ở tương lai hoặc vừa mới tạo
  if (diffMs < 45 * 1000) {
    return 'vừa xong'
  }

  const diffMinutes = Math.floor(diffMs / (60 * 1000))
  if (diffMinutes < 60) {
    return `${diffMinutes} phút trước`
  }

  const diffHours = Math.floor(diffMs / (3600 * 1000))
  if (diffHours < 24) {
    return `${diffHours} giờ trước`
  }

  const diffDays = Math.floor(diffMs / (86400 * 1000))
  if (diffDays === 1) {
    return 'Hôm qua'
  }
  if (diffDays < 7) {
    return `${diffDays} ngày trước`
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

export type DateGroupLabel = 'Hôm nay' | 'Hôm qua' | 'Tuần này' | 'Cũ hơn'

export function getDateGroupLabel(isoString: string): DateGroupLabel {
  const date = new Date(isoString)
  const now = new Date()

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfYesterday = startOfToday - 86400 * 1000
  const startOfThisWeek = startOfToday - 6 * 86400 * 1000

  const time = date.getTime()
  if (time >= startOfToday) {
    return 'Hôm nay'
  }
  if (time >= startOfYesterday) {
    return 'Hôm qua'
  }
  if (time >= startOfThisWeek) {
    return 'Tuần này'
  }
  return 'Cũ hơn'
}

/**
 * Định dạng đếm ngược giây: mm:ss (vd: "0:42")
 */
export function formatCountdown(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return '0:00'
  const mins = Math.floor(remainingSeconds / 60)
  const secs = Math.floor(remainingSeconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

