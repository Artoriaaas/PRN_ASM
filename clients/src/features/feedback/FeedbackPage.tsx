import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getUserTickets,
  getTicketDetail,
  submitFeedback,
  replyTicket,
  type FeedbackTicket,
} from '../../api/supportClient'
import { useToast } from '../../components/ui/Toast'
import './feedback.css'

export function FeedbackPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTicketId = searchParams.get('ticketId') || ''
  const toast = useToast()

  const [tickets, setTickets] = useState<FeedbackTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<FeedbackTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)

  // Modal new ticket
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newType, setNewType] = useState('BUG')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newMatchId, setNewMatchId] = useState('')
  const [submittingTicket, setSubmittingTicket] = useState(false)

  const loadTickets = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setLoading(true)
        const res = await getUserTickets(1, 50, signal)
        setTickets(res.items)

        // Nếu có ticketId trong URL hoặc đã chọn
        const targetId = initialTicketId || selectedTicket?.id
        if (targetId) {
          const detail = await getTicketDetail(targetId, signal).catch(() => null)
          if (detail) setSelectedTicket(detail)
        } else if (res.items.length > 0 && !selectedTicket) {
          const detail = await getTicketDetail(res.items[0].id, signal).catch(() => null)
          if (detail) setSelectedTicket(detail)
        }
      } catch (err) {
        if (!signal?.aborted) {
          toast(err instanceof Error ? err.message : 'Lỗi khi tải phản hồi', 'error')
        }
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialTicketId],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadTickets(controller.signal)
    return () => controller.abort()
  }, [loadTickets])

  const handleSelectTicket = async (ticket: FeedbackTicket) => {
    try {
      const detail = await getTicketDetail(ticket.id)
      setSelectedTicket(detail)
      setSearchParams({ ticketId: ticket.id })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Lỗi khi tải chi tiết', 'error')
    }
  }

  const handleCreateTicket = async (e: FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newContent.trim()) {
      toast('Vui lòng điền đầy đủ tiêu đề và nội dung', 'warning')
      return
    }

    try {
      setSubmittingTicket(true)
      const created = await submitFeedback({
        type: newType,
        title: newTitle.trim(),
        content: newContent.trim(),
        relatedMatchId: newMatchId.trim() || undefined,
      })
      toast('Đã gửi phản hồi thành công!', 'success')
      setIsModalOpen(false)
      setNewTitle('')
      setNewContent('')
      setNewMatchId('')
      setTickets((prev) => [created, ...prev])
      setSelectedTicket(created)
      setSearchParams({ ticketId: created.id })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Lỗi gửi phản hồi', 'error')
    } finally {
      setSubmittingTicket(false)
    }
  }

  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedTicket || !replyContent.trim()) return

    try {
      setSubmittingReply(true)
      const newMsg = await replyTicket(selectedTicket.id, replyContent.trim())
      setSelectedTicket((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          messages: [...(prev.messages || []), newMsg],
        }
      })
      setReplyContent('')
      toast('Đã gửi câu trả lời!', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Không thể gửi trả lời', 'error')
    } finally {
      setSubmittingReply(false)
    }
  }

  const formatType = (type: string) => {
    switch (type) {
      case 'BUG':
        return <span className="ticket-type-badge badge-bug">Lỗi</span>
      case 'SUGGESTION':
        return <span className="ticket-type-badge badge-suggestion">Góp ý</span>
      case 'REPORT_PLAYER':
        return <span className="ticket-type-badge badge-report">Báo cáo</span>
      default:
        return <span className="ticket-type-badge badge-other">Khác</span>
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'NEW':
        return <span className="status-badge status-new">Mới tiếp nhận</span>
      case 'IN_PROGRESS':
        return <span className="status-badge status-in_progress">Đang xử lý</span>
      case 'RESOLVED':
        return <span className="status-badge status-resolved">Đã giải quyết</span>
      case 'CLOSED':
        return <span className="status-badge status-closed">Đã đóng</span>
      default:
        return <span className="status-badge">{status}</span>
    }
  }

  return (
    <div className="feedback-page">
      <header className="feedback-header">
        <div>
          <h1>Hỗ trợ & Góp ý</h1>
          <p>Gửi câu hỏi, báo lỗi hoặc phản ánh người chơi tới ban quản trị</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setIsModalOpen(true)}
        >
          <span>+</span> Gửi phản hồi mới
        </button>
      </header>

      {loading ? (
        <div className="empty-state">Đang tải danh sách phản hồi...</div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <p>Bạn chưa gửi yêu cầu hỗ trợ nào.</p>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={() => setIsModalOpen(true)}
          >
            Tạo phản hồi đầu tiên
          </button>
        </div>
      ) : (
        <div className="feedback-grid">
          {/* Danh sách ticket */}
          <div className="ticket-list-card">
            <div className="card-header">
              <h2>Phiếu hỗ trợ của bạn ({tickets.length})</h2>
            </div>
            <ul className="ticket-list">
              {tickets.map((t) => {
                const isActive = selectedTicket?.id === t.id
                return (
                  <li
                    key={t.id}
                    className={`ticket-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectTicket(t)}
                  >
                    <div className="ticket-item-top">
                      {formatType(t.type)}
                      {formatStatus(t.status)}
                    </div>
                    <div className="ticket-item-title">{t.title}</div>
                    <div className="ticket-item-date">
                      {new Date(t.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Chi tiết hội thoại */}
          <div className="ticket-detail-card">
            {selectedTicket ? (
              <div className="conversation-container">
                <div className="card-header">
                  <div>
                    <h2>{selectedTicket.title}</h2>
                    <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                      {formatType(selectedTicket.type)}
                      {formatStatus(selectedTicket.status)}
                    </div>
                  </div>
                </div>

                <div className="conversation-thread">
                  {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                    selectedTicket.messages.map((m) => {
                      const isAdmin = m.senderRole === 'ADMIN'
                      return (
                        <div
                          key={m.id}
                          className={`message-bubble ${isAdmin ? 'admin' : 'user'}`}
                        >
                          <div className="message-meta">
                            <strong>{isAdmin ? '🛡️ Ban Quản Trị' : 'Bạn'}</strong>
                            <span>{new Date(m.createdAt).toLocaleTimeString('vi-VN')}</span>
                          </div>
                          <div>{m.content}</div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="empty-state">Chưa có nội dung trao đổi</div>
                  )}
                </div>

                {selectedTicket.status !== 'CLOSED' ? (
                  <form className="reply-form" onSubmit={handleSendReply}>
                    <textarea
                      placeholder="Nhập nội dung trả lời thêm..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      required
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={submittingReply || !replyContent.trim()}
                      >
                        {submittingReply ? 'Đang gửi...' : 'Gửi phản hồi'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div
                    style={{
                      padding: '1rem',
                      textAlign: 'center',
                      background: '#f8fafc',
                      color: '#64748b',
                      fontSize: '0.9rem',
                    }}
                  >
                    Phiếu hỗ trợ này đã được đóng.
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">Chọn một phiếu hỗ trợ để xem chi tiết</div>
            )}
          </div>
        </div>
      )}

      {/* Modal gửi phản hồi mới */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Gửi yêu cầu hỗ trợ / Góp ý</h3>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.2rem 0.5rem' }}
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateTicket}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="feedback-type">Loại phản hồi</label>
                  <select
                    id="feedback-type"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                  >
                    <option value="BUG">Báo lỗi trò chơi (Bug)</option>
                    <option value="SUGGESTION">Đóng góp ý kiến (Suggestion)</option>
                    <option value="REPORT_PLAYER">Báo cáo gian lận / Người chơi (Report)</option>
                    <option value="OTHER">Chủ đề khác</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="feedback-title">Tiêu đề</label>
                  <input
                    id="feedback-title"
                    type="text"
                    placeholder="Mô tả ngắn gọn vấn đề..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                {newType === 'REPORT_PLAYER' && (
                  <div className="form-group">
                    <label htmlFor="feedback-match-id">Mã trận đấu (nếu có)</label>
                    <input
                      id="feedback-match-id"
                      type="text"
                      placeholder="Ví dụ: UUID trận đấu"
                      value={newMatchId}
                      onChange={(e) => setNewMatchId(e.target.value)}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="feedback-content">Nội dung chi tiết</label>
                  <textarea
                    id="feedback-content"
                    rows={4}
                    placeholder="Vui lòng nêu chi tiết các bước xảy ra lỗi hoặc ý kiến đóng góp..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submittingTicket || !newTitle.trim() || !newContent.trim()}
                >
                  {submittingTicket ? 'Đang gửi...' : 'Gửi phản hồi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
