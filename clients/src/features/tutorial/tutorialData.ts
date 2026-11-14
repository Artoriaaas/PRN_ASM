/**
 * tutorialData.ts — nội dung tất cả các bước tutorial.
 * Tách riêng khỏi component để dễ sửa nội dung.
 */

export type TutorialMode = 'classic' | 'shuffle' | 'multiplayer-race' | 'multiplayer-duel'

export type TutorialStep = {
  id: string
  title: string
  content: string
  /** Các ô cần highlight trên bàn cờ (index 0-80). Rỗng = không highlight ô nào */
  highlightCells?: number[]
  /** Nhóm vùng cần highlight (hàng/cột/vùng): vd 'row-4', 'col-2', 'box-0' */
  highlightGroup?: string
  /** Ô nên được chọn để demo */
  selectCell?: number
  /** Giá trị gợi ý nhập vào ô được chọn (chỉ hiển thị, không thực sự điền) */
  demoValue?: number
  /** Nút hành động thêm (ngoài Tiếp theo / Bỏ qua) */
  action?: {
    label: string
    type: 'toggle-notes' | 'delete' | 'hint' | 'pause'
  }
  /** Icon hiển thị bên cạnh tiêu đề */
  icon?: string
}

// ─── CLASSIC TUTORIAL ─────────────────────────────────────────────────────────

export const CLASSIC_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    icon: '🎯',
    title: 'Chào mừng đến với Sudoku!',
    content:
      'Sudoku là trò chơi điền số. Mục tiêu: điền các số từ 1 đến 9 vào các ô trống sao cho mỗi hàng, mỗi cột và mỗi khối 3×3 chứa đủ các số từ 1 đến 9 — không số nào bị lặp lại.',
  },
  {
    id: 'given-cells',
    icon: '🔒',
    title: 'Ô đề (số cho sẵn)',
    content:
      'Các số màu đậm là ô đề — chúng được cho sẵn và không thể thay đổi. Hãy dùng chúng làm manh mối để suy luận.',
    highlightCells: [0, 1, 3, 9, 14, 20, 27, 33, 40, 45, 50, 54, 60, 68, 74, 80],
  },
  {
    id: 'select-cell',
    icon: '👆',
    title: 'Chọn một ô',
    content:
      'Nhấn vào bất kỳ ô trống nào để chọn nó. Ô được chọn sẽ được tô sáng màu tím. Các ô cùng hàng, cột và vùng sẽ tô màu nhạt hơn.',
    selectCell: 10,
  },
  {
    id: 'fill-number',
    icon: '✏️',
    title: 'Điền số',
    content:
      'Sau khi chọn ô, nhấn một số từ 1-9 trên bàn phím hoặc bấm nút số ở bên phải. Số màu tím là số bạn tự điền — chúng có thể xóa được.',
    selectCell: 10,
    demoValue: 6,
  },
  {
    id: 'conflict-detect',
    icon: '⚠️',
    title: 'Phát hiện xung đột',
    content:
      'Nếu bạn điền một số đã có trong cùng hàng, cột hoặc vùng, ô đó sẽ được đánh dấu đỏ và gạch chân. Đây là xung đột — cần xóa và điền lại.',
  },
  {
    id: 'mistakes-limit',
    icon: '❤️',
    title: 'Giới hạn lỗi',
    content:
      'Mỗi ván bạn có tối đa 3 lần sai. Mỗi lần điền số sai sẽ trừ 1 mạng (tim). Hết 3 mạng — ván kết thúc. Hãy suy nghĩ kỹ trước khi điền!',
  },
  {
    id: 'notes-intro',
    icon: '✎',
    title: 'Chế độ ghi chú',
    content:
      'Nhấn nút "Ghi chú" hoặc phím N để bật chế độ ghi chú. Trong chế độ này, số bạn nhập sẽ được lưu dưới dạng ghi chú nhỏ trong góc ô — rất hữu ích khi bạn chưa chắc chắn số nào đúng.',
    action: { label: 'Thử bật Ghi chú', type: 'toggle-notes' },
  },
  {
    id: 'notes-multiple',
    icon: '📝',
    title: 'Ghi chú nhiều số',
    content:
      'Bạn có thể ghi nhiều số vào cùng một ô khi đang ở chế độ ghi chú. Nhấn cùng số đó lần nữa để xóa ghi chú. Khi bạn xác định được số đúng và điền vào, ghi chú sẽ tự xóa.',
  },
  {
    id: 'delete-cell',
    icon: '⌫',
    title: 'Xóa số',
    content:
      'Chọn ô rồi nhấn nút "Xóa" hoặc phím Backspace / Delete để xóa số vừa điền. Bạn không thể xóa các số được cho sẵn (ô đề).',
    action: { label: 'Thử xóa ô', type: 'delete' },
  },
  {
    id: 'hint-system',
    icon: '💡',
    title: 'Gợi ý thông minh',
    content:
      'Bí quá không giải được? Nhấn nút "Gợi ý" hoặc phím H để nhận gợi ý. Hệ thống sẽ chỉ ra một ô và số chính xác để điền. Mỗi ván có tối đa 3 lần gợi ý.',
    action: { label: 'Thử dùng Gợi ý', type: 'hint' },
  },
  {
    id: 'keyboard-shortcuts',
    icon: '⌨️',
    title: 'Phím tắt',
    content:
      'Desktop: dùng phím mũi tên ↑ ↓ ← → để di chuyển giữa các ô. Phím 1-9 để điền số. Phím N bật/tắt ghi chú. Phím H để gợi ý. Phím Backspace/Delete để xóa.',
  },
  {
    id: 'strategy-naked-single',
    icon: '🎓',
    title: 'Kỹ thuật cơ bản: Naked Single',
    content:
      '"Naked Single" — Nếu một ô chỉ còn một số có thể điền (do 8 số còn lại đã xuất hiện trong hàng, cột hoặc vùng của nó), đó chính là số phải điền. Đây là kỹ thuật đơn giản nhất!',
    selectCell: 20,
  },
  {
    id: 'strategy-hidden-single',
    icon: '🔍',
    title: 'Kỹ thuật: Hidden Single',
    content:
      '"Hidden Single" — Nếu trong một hàng (hoặc cột, hoặc vùng), chỉ có một ô duy nhất có thể chứa một số nhất định, thì điền số đó vào ô đó — dù ô đó còn nhiều ứng viên khác.',
  },
  {
    id: 'win-condition',
    icon: '🏆',
    title: 'Điều kiện thắng',
    content:
      'Điền đúng tất cả 81 ô — bạn thắng! Thời gian hoàn thành ngắn hơn và ít lỗi hơn sẽ cho điểm cao hơn và nhiều XP hơn.',
  },
  {
    id: 'ready',
    icon: '🚀',
    title: 'Sẵn sàng chưa?',
    content:
      'Bạn đã nắm đủ những điều cần biết để bắt đầu! Hãy thử ở độ khó Dễ trước và dần tăng lên. Chúc bạn chơi vui! Mọi câu hỏi có thể xem lại trong phần Học kỹ thuật.',
  },
]

// ─── SHUFFLE TUTORIAL ─────────────────────────────────────────────────────────

export const SHUFFLE_STEPS: TutorialStep[] = [
  {
    id: 'shuffle-intro',
    icon: '◈',
    title: 'Shuffle / Irregular Layout',
    content:
      'Trong chế độ Shuffle, 9 vùng không còn là các khối 3×3 đều nhau nữa. Các vùng có hình dạng bất quy tắc — và viền dày hơn sẽ phân chia các vùng khác nhau.',
  },
  {
    id: 'shuffle-borders',
    icon: '🔲',
    title: 'Đọc viền vùng',
    content:
      'Viền dày = ranh giới giữa hai vùng khác nhau. Viền mỏng = cùng vùng. Quy tắc không đổi: mỗi vùng bất quy tắc phải chứa đủ 9 chữ số từ 1 đến 9.',
  },
  {
    id: 'shuffle-region-colors',
    icon: '🎨',
    title: 'Màu nền vùng (tùy chọn)',
    content:
      'Nếu bật tô màu vùng trong Cài đặt, mỗi vùng sẽ có màu nền nhạt khác nhau để phân biệt dễ hơn. Điều này đặc biệt hữu ích khi mới làm quen với layout Shuffle.',
  },
  {
    id: 'shuffle-same-rules',
    icon: '✅',
    title: 'Luật chơi giống hệt Classic',
    content:
      'Ngoài hình dạng vùng, mọi luật khác giữ nguyên: mỗi hàng, cột và vùng bất quy tắc không được có số trùng. Tất cả kỹ thuật giải (Naked Single, Hidden Single...) vẫn áp dụng được.',
  },
  {
    id: 'shuffle-harder',
    icon: '🧠',
    title: 'Thử thách cao hơn',
    content:
      'Shuffle thường khó hơn Classic cùng độ khó vì vùng bất quy tắc tạo ra các mối ràng buộc khó nhận ra hơn. Nếu bạn mới chơi, hãy làm quen với Classic trước.',
  },
  {
    id: 'shuffle-ready',
    icon: '🚀',
    title: 'Thách thức bản thân!',
    content:
      'Shuffle là thử thách tuyệt vời khi bạn đã thành thạo Classic. Hãy bắt đầu với Dễ Shuffle để làm quen với cách đọc vùng bất quy tắc. Chúc bạn thành công!',
  },
]

// ─── MULTIPLAYER RULES ────────────────────────────────────────────────────────

export type MultiplayerRulesSection = {
  id: string
  icon: string
  title: string
  content: string
  highlight?: string // class CSS bổ sung
}

export const RACE_RULES: MultiplayerRulesSection[] = [
  {
    id: 'race-overview',
    icon: '⚡',
    title: 'Tổng quan Race',
    content:
      'Race là chế độ đua tốc độ 1 đối 1. Cả hai người chơi nhận cùng một bàn Sudoku và bắt đầu giải cùng lúc. Người hoàn thành đúng và nhanh hơn sẽ thắng.',
  },
  {
    id: 'race-scoring',
    icon: '🏅',
    title: 'Cách tính điểm Race',
    content:
      'Thắng được xác định bởi: (1) Người điền đúng tất cả ô đầu tiên thắng. (2) Nếu hết giờ — người điền đúng nhiều ô hơn thắng. (3) Bằng nhau → người ít lỗi hơn thắng.',
    highlight: 'rules-highlight',
  },
  {
    id: 'race-penalty',
    icon: '⏱️',
    title: 'Hình phạt khi sai',
    content:
      'Mỗi lần điền số sai: mất 1 mạng (tim) VÀ bị cộng thêm +10 giây vào thời gian của bạn. Cùng một ô chỉ bị phạt một lần cho cùng số sai. Tối đa 3 mạng — hết mạng = thua cuộc.',
  },
  {
    id: 'race-opponent',
    icon: '👥',
    title: 'Theo dõi đối thủ',
    content:
      'Thanh tiến độ đối thủ cho thấy họ đã điền được bao nhiêu % số ô đúng — nhưng không lộ ô cụ thể nào. Hãy tập trung vào bàn của mình!',
  },
  {
    id: 'race-surrender',
    icon: '🏳️',
    title: 'Đầu hàng',
    content:
      'Bạn có thể nhấn "Đầu hàng" bất kỳ lúc nào. Điều này sẽ tính là thua và ảnh hưởng đến Elo của bạn. Nếu mất kết nối quá 30 giây — tự động thua.',
  },
  {
    id: 'race-elo',
    icon: '📊',
    title: 'Elo Race',
    content:
      'Mỗi kết quả trận thay đổi Elo Race riêng của bạn (tách biệt với Elo Duel). Elo phản ánh kỹ năng tương đối so với những người chơi khác cùng format.',
  },
]

export const DUEL_RULES: MultiplayerRulesSection[] = [
  {
    id: 'duel-overview',
    icon: '♟️',
    title: 'Tổng quan Duel',
    content:
      'Duel là chế độ đấu luân phiên. Cả hai người chơi dùng CHUNG một bàn Sudoku. Mỗi lượt chỉ một người được điền — và chỉ có 15 giây để suy nghĩ.',
  },
  {
    id: 'duel-scoring',
    icon: '🏅',
    title: 'Cách tính điểm Duel',
    content:
      'Điền đúng: +10 điểm cơ bản. Điền đúng liên tiếp nhanh (ít giây hơn): bonus thêm điểm. Điền sai: -5 điểm, mất lượt, mất 1 mạng. Người có nhiều điểm hơn khi bàn hoàn thành — thắng.',
    highlight: 'rules-highlight',
  },
  {
    id: 'duel-turn',
    icon: '⏰',
    title: 'Luật lượt chơi',
    content:
      'Mỗi lượt có 15 giây. Nếu hết giờ mà chưa điền — mất lượt (nhưng không mất điểm hay tim). Đồng hồ đếm ngược hiển thị rõ ràng. Cẩn thận với áp lực thời gian!',
  },
  {
    id: 'duel-shared-board',
    icon: '🎯',
    title: 'Bàn chung — Chiến thuật',
    content:
      'Vì cả hai dùng chung bàn, bạn thấy được ô đối thủ vừa điền (viền cam nhấp nháy). Có thể có chiến thuật: điền các ô khó để "nhường" ô dễ cho đối thủ ít điểm.',
  },
  {
    id: 'duel-lives',
    icon: '❤️',
    title: 'Mạng trong Duel',
    content:
      'Mỗi người có 3 mạng riêng. Điền sai mất 1 mạng. Hết mạng — thua ngay, bất kể điểm số. Người còn lại tự động thắng. Chú ý cả điểm lẫn mạng!',
  },
  {
    id: 'duel-elo',
    icon: '📊',
    title: 'Elo Duel',
    content:
      'Elo Duel tách biệt hoàn toàn với Elo Race. Thắng Duel tăng Elo Duel. Bạn có thể giỏi Race nhưng vẫn còn mới với Duel — cả hai đều cần luyện tập riêng.',
  },
]


