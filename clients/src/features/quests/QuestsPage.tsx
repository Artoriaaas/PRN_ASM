import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QuestsModal } from './QuestsModal'
import { loadTodayQuests } from './questSystem'
import type { DailyQuest } from './questSystem'

/**
 * Trang /quests: hiển thị modal nhiệm vụ ở giữa màn hình.
 * Khi đóng modal, điều hướng về trang trước.
 * Quests được tải mới từ localStorage ngay khi khởi tạo state.
 */
export function QuestsPage() {
  const navigate = useNavigate()
  // Khởi tạo trực tiếp trong useState để tránh effect phụ
  const [quests] = useState<DailyQuest[]>(() => loadTodayQuests())

  function handleClose() {
    navigate(-1)
  }

  return <QuestsModal quests={quests} onClose={handleClose} />
}
