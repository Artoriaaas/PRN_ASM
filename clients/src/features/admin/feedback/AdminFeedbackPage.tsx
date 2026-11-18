import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  adminGetFeedbackQueue,
  adminGetTicketDetail,
  adminReplyFeedback,
  adminChangeStatus,
  type FeedbackTicket,
} from '../../../api/supportClient'

export function AdminFeedbackPage() {
  const [tickets, setTickets] = useState<FeedbackTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<FeedbackTicket | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reply state
  const [replyContent, setReplyContent] = useState('')
  const [replyReason, setReplyReason] = useState('Phản hồi hỗ trợ người dùng')
  const [replyLoading, setReplyLoading] = useState(false)

  // Change status state
  const [newStatus, setNewStatus] = useState('')
  const [statusReason, setStatusReason] = useState('')
  const [statusUpdating, setStatusUpdating] = useState(false)

  const loadQueue = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminGetFeedbackQueue({
        page,
        pageSize: 20,
        status: statusFilter,
        type: typeFilter,
        search,
      })
      setTickets(res.items)
      setTotalCount(res.totalCount)
      if (res.items.length > 0 && !selectedTicket) {
        loadDetail(res.items[0].id)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi tải hàng đợi feedback.')
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const detail = await adminGetTicketDetail(id)
      setSelectedTicket(detail)
      setNewStatus(detail.status)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi tải chi tiết ticket.')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()
  }, [page, statusFilter, typeFilter])

  const handleSendReply = async () => {
    if (!selectedTicket || !replyContent.trim() || !replyReason.trim()) return
    setReplyLoading(true)
    try {
      await adminReplyFeedback(selectedTicket.id, replyContent.trim(), replyReason.trim())
      setReplyContent('')
      await loadDetail(selectedTicket.id)
      loadQueue()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi gửi phản hồi.')
    } finally {
      setReplyLoading(false)
    }
  }

  const handleChangeStatus = async () => {
    if (!selectedTicket || !newStatus || !statusReason.trim()) {
      alert('Vui lòng chọn trạng thái và nhập lý do.')
      return
    }
    setStatusUpdating(true)
    try {
      const updated = await adminChangeStatus(selectedTicket.id, newStatus, statusReason.trim())
      setSelectedTicket(updated)
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === updated.id
            ? { ...ticket, status: updated.status, updatedAt: updated.updatedAt }
            : ticket,
        ),
      )
      setStatusReason('')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi đổi trạng thái.')
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Hàng đợi Feedback & Báo cáo ({totalCount})</h1>
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: '0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠️ {error}</span>
          <button
            className="admin-btn admin-btn-secondary"
            style={{ padding: '2px 10px', fontSize: '0.8rem' }}
            onClick={loadQueue}
          >
            Thử lại
          </button>
        </div>
      )}

      <div className="admin-filters">
        <input
          type="text"
          className="admin-input"
          placeholder="Tìm theo tiêu đề hoặc UID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadQueue()}
          style={{ width: 260 }}
        />
        <button className="admin-btn admin-btn-primary" onClick={loadQueue}>
          Tìm
        </button>

        <select
          className="admin-select"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="NEW">Mới (NEW)</option>
          <option value="IN_PROGRESS">Đang xử lý (IN_PROGRESS)</option>
          <option value="RESOLVED">Đã giải quyết (RESOLVED)</option>
          <option value="CLOSED">Đã đóng (CLOSED)</option>
        </select>

        <select
          className="admin-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Tất cả thể loại</option>
          <option value="BUG">Báo lỗi (BUG)</option>
          <option value="SUGGESTION">Góp ý (SUGGESTION)</option>
          <option value="REPORT_PLAYER">Tố cáo người chơi (REPORT_PLAYER)</option>
          <option value="OTHER">Khác (OTHER)</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, minHeight: 600 }}>
        {/* Left: Queue List */}
        <div className="admin-card" style={{ maxHeight: 750, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20 }}>Đang tải hàng đợi...</div>
          ) : tickets.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
              Không có ticket nào.
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => loadDetail(t.id)}
                style={{
                  padding: 16,
                  borderBottom: '1px solid var(--line)',
                  cursor: 'pointer',
                  background: selectedTicket?.id === t.id ? 'var(--green-soft)' : '#fff',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className={`badge badge-${t.status.toLowerCase()}`}>{t.status}</span>
                  <span className="badge badge-user">{t.type}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>
                  {t.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {new Date(t.createdAt).toLocaleDateString('vi-VN')}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Ticket Conversation & Actions */}
        <div className="admin-card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
          {detailLoading ? (
            <div>Đang tải chi tiết...</div>
          ) : !selectedTicket ? (
            <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--muted)' }}>
              Chọn một ticket từ danh sách bên trái để xem nội dung
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Ticket Top Info */}
              <div
                style={{
                  borderBottom: '1px solid var(--line)',
                  paddingBottom: 16,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ margin: '0 0 6px 0', fontSize: '1.3rem' }}>{selectedTicket.title}</h2>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                      Mã ticket: <code>{selectedTicket.id}</code>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span className={`badge badge-${selectedTicket.status.toLowerCase()}`}>
                      {selectedTicket.status}
                    </span>
                    <span className="badge badge-user">{selectedTicket.type}</span>
                  </div>
                </div>

                {selectedTicket.type === 'REPORT_PLAYER' && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      background: '#fffbeb',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>⚠️ Ticket tố cáo người chơi gian lận hoặc vi phạm.</span>
                    <Link
                      to="/admin/users"
                      className="admin-btn admin-btn-danger"
                      style={{ fontSize: '0.8rem', padding: '4px 10px', textDecoration: 'none' }}
                    >
                      Mở quản lý người dùng để xử lý
                    </Link>
                  </div>
                )}
              </div>

              {/* Status Control */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: 16,
                  padding: '12px 16px',
                  background: 'var(--canvas)',
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              >
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--muted)' }}>
                    Trạng thái ticket:
                  </label>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <select
                      className="admin-select"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      disabled={selectedTicket.status === 'CLOSED'}
                      style={{ flex: 1 }}
                    >
                      <option value="NEW">NEW</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                    <button
                      className="admin-btn admin-btn-secondary"
                      onClick={handleChangeStatus}
                      disabled={
                        statusUpdating ||
                        selectedTicket.status === 'CLOSED' ||
                        newStatus === selectedTicket.status
                      }
                    >
                      {statusUpdating ? 'Đang đổi...' : 'Đổi'}
                    </button>
                  </div>
                  <input
                    type="text"
                    className="admin-input"
                    placeholder="Lý do đổi trạng thái..."
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    style={{ width: '100%', marginTop: 6 }}
                  />

                  {selectedTicket.statusHistory && selectedTicket.statusHistory.length > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>
                        Lịch sử đổi trạng thái đã thông báo cho người dùng:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {selectedTicket.statusHistory.map((entry) => (
                          <div
                            key={`${entry.createdAt}-${entry.newStatus}`}
                            style={{
                              padding: '8px 10px',
                              background: '#fff',
                              border: '1px solid var(--line)',
                              borderRadius: 8,
                              fontSize: '0.84rem',
                            }}
                          >
                            <div style={{ fontWeight: 700 }}>
                              {entry.oldStatus || '—'} → {entry.newStatus || '—'}
                              <span style={{ marginLeft: 8, color: 'var(--muted)', fontWeight: 400 }}>
                                {new Date(entry.createdAt).toLocaleString('vi-VN')}
                              </span>
                            </div>
                            <div style={{ marginTop: 4 }}>Lý do: {entry.reason}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Conversation */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  padding: 12,
                  background: '#faf9f5',
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  marginBottom: 16,
                  maxHeight: 320,
                }}
              >
                {selectedTicket.messages?.map((msg) => {
                  const isAdmin = msg.senderRole === 'ADMIN'
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: isAdmin ? 'var(--green)' : '#fff',
                        color: isAdmin ? '#fff' : 'var(--ink)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        border: isAdmin ? 'none' : '1px solid var(--line)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.75rem',
                          marginBottom: 4,
                          color: isAdmin ? '#e4eee8' : 'var(--muted)',
                          fontWeight: 700,
                        }}
                      >
                        {isAdmin ? '🛡️ Quản trị viên' : '👤 Người chơi'} •{' '}
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.92rem' }}>{msg.content}</div>
                    </div>
                  )
                })}
              </div>

              {/* Reply Box */}
              {selectedTicket.status === 'CLOSED' ? (
                <div className="alert-warning" style={{ textAlign: 'center' }}>
                  🔒 Ticket này đã đóng (CLOSED). Không thể gửi thêm tin nhắn.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    placeholder="Nhập nội dung phản hồi cho người chơi..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      minHeight: 60,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="admin-input"
                      placeholder="Lý do phản hồi..."
                      value={replyReason}
                      onChange={(e) => setReplyReason(e.target.value)}
                      style={{ width: 250 }}
                    />
                    <button
                      className="admin-btn admin-btn-primary"
                      onClick={handleSendReply}
                      disabled={replyLoading || !replyContent.trim() || !replyReason.trim()}
                    >
                      {replyLoading ? 'Đang gửi...' : 'Gửi phản hồi'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
