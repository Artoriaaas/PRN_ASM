import { useNotifications } from '../useNotifications'

export function DevNotificationControls() {
  const {
    simulateInvite,
    simulateEloGain,
    simulateLessonComplete,
    simulateTenNotifications,
    clearAllNotifications,
  } = useNotifications()

  if (!import.meta.env.DEV) return null

  return (
    <div className="notif-dev-panel" aria-label="Bảng công cụ giả lập thông báo dành cho nhà phát triển">
      <span className="notif-dev-label">DEV TEST:</span>
      <button
        type="button"
        className="notif-dev-btn"
        onClick={simulateInvite}
        title="Giả lập nhận lời mời thách đấu 1v1 từ Minh Anh"
      >
        + Lời mời
      </button>
      <button
        type="button"
        className="notif-dev-btn"
        onClick={simulateEloGain}
        title="Giả lập cộng 22 điểm Elo sau ván đấu"
      >
        + Elo (+22)
      </button>
      <button
        type="button"
        className="notif-dev-btn"
        onClick={simulateLessonComplete}
        title="Giả lập hoàn thành bài học Sudoku 4/7"
      >
        + Học bài
      </button>
      <button
        type="button"
        className="notif-dev-btn"
        onClick={simulateTenNotifications}
        title="Tạo nhanh 11 thông báo để kiểm tra huy hiệu 9+"
        style={{ color: '#0369A1', borderColor: '#0284C7' }}
      >
        + Tạo 11 tb (test 9+)
      </button>
      <button
        type="button"
        className="notif-dev-btn"
        onClick={clearAllNotifications}
        title="Xóa hết danh sách về 0 để kiểm tra ẩn chuông"
        style={{ color: '#DC2626', borderColor: '#EF4444' }}
      >
        Xóa hết (về 0)
      </button>
    </div>
  )
}
