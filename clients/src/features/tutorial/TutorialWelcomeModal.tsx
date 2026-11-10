/**
 * TutorialWelcomeModal — popup hỏi người dùng mới có muốn chơi tutorial không.
 * Xuất hiện:
 *   1. Lần đầu tạo tài khoản → hỏi classic tutorial
 *   2. Lần đầu chọn layout Shuffle → hỏi shuffle tutorial
 */
import { Modal } from '../../components/ui/Modal'

type TutorialWelcomeModalProps = {
  open: boolean
  mode: 'classic' | 'shuffle'
  onAccept: () => void
  onSkip: () => void
}

const CONTENT = {
  classic: {
    icon: '🎯',
    title: 'Bạn có muốn xem hướng dẫn không?',
    lead: 'Có vẻ đây là lần đầu bạn chơi Sudoku ở đây!',
    desc: 'Hướng dẫn ngắn sẽ giúp bạn làm quen với giao diện, cách điền số, chế độ ghi chú, gợi ý và một số kỹ thuật cơ bản để giải đúng.',
    acceptLabel: 'Xem hướng dẫn →',
    skipLabel: 'Bỏ qua, chơi luôn',
    benefits: [
      '📝 Cách dùng ghi chú (Notes)',
      '💡 Cách xin gợi ý (Hint)',
      '🎓 Kỹ thuật Naked Single & Hidden Single',
      '⌨️ Phím tắt hữu ích',
    ],
  },
  shuffle: {
    icon: '◈',
    title: 'Layout mới — Shuffle / Irregular',
    lead: 'Bạn vừa chọn chế độ Shuffle lần đầu!',
    desc: 'Shuffle dùng các vùng bất quy tắc thay cho khối 3×3 quen thuộc. Hướng dẫn ngắn sẽ giúp bạn hiểu cách đọc viền vùng và điều chỉnh chiến thuật.',
    acceptLabel: 'Xem hướng dẫn Shuffle →',
    skipLabel: 'Tôi đã biết, bỏ qua',
    benefits: [
      '🔲 Cách đọc viền dày/mỏng phân vùng',
      '🎨 Màu nền phân biệt vùng',
      '🧠 Tại sao Shuffle khó hơn Classic',
      '✅ Luật chơi vẫn giữ nguyên',
    ],
  },
}

export function TutorialWelcomeModal({
  open,
  mode,
  onAccept,
  onSkip,
}: TutorialWelcomeModalProps) {
  const c = CONTENT[mode]

  return (
    <Modal
      open={open}
      title=""
      onClose={onSkip}
      footer={
        <div className="tutorial-modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onSkip}>
            {c.skipLabel}
          </button>
          <button type="button" className="btn btn-primary" onClick={onAccept}>
            {c.acceptLabel}
          </button>
        </div>
      }
    >
      <div className="tutorial-welcome">
        <div className="tw-icon" aria-hidden="true">{c.icon}</div>
        <div className="tw-lead">{c.lead}</div>
        <h3 className="tw-title">{c.title}</h3>
        <p className="tw-desc">{c.desc}</p>
        <ul className="tw-benefits">
          {c.benefits.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="tw-note">
          Bạn luôn có thể xem lại hướng dẫn trong mục{' '}
          <strong>Học kỹ thuật</strong> bất cứ lúc nào.
        </p>
      </div>
    </Modal>
  )
}

