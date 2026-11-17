import { useState, useEffect } from 'react'
import { adminUserClient } from '../../../api/adminClient'
import type { AdminUserSummary, AuditLogEntry } from '../../../gen/sudoku/user/v1/user_pb'

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null)
  const [banModalOpen, setBanModalOpen] = useState(false)
  const [banReason, setBanReason] = useState('')
  const [bannedUntil, setBannedUntil] = useState('')

  const [eloModalOpen, setEloModalOpen] = useState(false)
  const [eloDelta, setEloDelta] = useState(50)
  const [eloOperation, setEloOperation] = useState('ADD')
  const [eloReason, setEloReason] = useState('')

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  const [actionLoading, setActionLoading] = useState(false)

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminUserClient.adminListUsers({
        page,
        pageSize,
        search,
        statusFilter,
        sortBy,
      })
      // Loại bỏ tài khoản dev guest khỏi danh sách
      const validUsers = (res.users || []).filter((u) => u.email !== 'guest@sudoku.local')
      setUsers(validUsers)
      setTotalCount(validUsers.length)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi tải danh sách người dùng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [page, statusFilter, sortBy])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadUsers()
  }

  const handleBanUser = async () => {
    if (!selectedUser || !banReason.trim()) return
    setActionLoading(true)
    try {
      await adminUserClient.adminBanUser({
        userId: selectedUser.id,
        reason: banReason.trim(),
        bannedUntil: bannedUntil ? new Date(bannedUntil).toISOString() : '',
      })
      setBanModalOpen(false)
      setBanReason('')
      setBannedUntil('')
      loadUsers()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi khóa tài khoản.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnbanUser = async (u: AdminUserSummary) => {
    const reason = prompt('Nhập lý do mở khóa tài khoản (bắt buộc):')
    if (!reason || !reason.trim()) return
    setActionLoading(true)
    try {
      await adminUserClient.adminUnbanUser({
        userId: u.id,
        reason: reason.trim(),
      })
      loadUsers()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi mở khóa tài khoản.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAdjustElo = async () => {
    if (!selectedUser || !eloReason.trim()) return
    setActionLoading(true)
    try {
      await adminUserClient.adminAdjustElo({
        userId: selectedUser.id,
        delta: Number(eloDelta),
        operation: eloOperation,
        reason: eloReason.trim(),
      })
      setEloModalOpen(false)
      setEloReason('')
      loadUsers()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi điều chỉnh elo.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!selectedUser || !deleteReason.trim()) return
    setActionLoading(true)
    try {
      await adminUserClient.adminSoftDeleteUser({
        userId: selectedUser.id,
        reason: deleteReason.trim(),
      })
      setDeleteModalOpen(false)
      setDeleteReason('')
      loadUsers()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi xóa tài khoản.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleViewAuditLogs = async (u?: AdminUserSummary) => {
    setAuditModalOpen(true)
    setAuditLoading(true)
    try {
      const res = await adminUserClient.adminListAuditLogs({
        targetId: u ? u.id : '',
        actorId: '',
        fromDate: '',
        toDate: '',
        page: 1,
        pageSize: 50,
      })
      setAuditLogs(res.logs)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Lỗi tải audit logs.')
    } finally {
      setAuditLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div>
      <div className="admin-header">
        <h1>Quản lý người dùng ({totalCount})</h1>
        <button
          className="admin-btn admin-btn-secondary"
          onClick={() => handleViewAuditLogs()}
        >
          📋 Xem tất cả Audit Logs
        </button>
      </div>

      <form className="admin-filters" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          className="admin-input"
          placeholder="Tìm theo tên hoặc email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
        />
        <button type="submit" className="admin-btn admin-btn-primary">
          Tìm kiếm
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
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="deleted">Deleted</option>
        </select>

        <select
          className="admin-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="created_at">Sắp xếp: Ngày tạo</option>
          <option value="elo">Sắp xếp: Điểm Elo</option>
        </select>
      </form>

      {error && <div className="alert-warning">{error}</div>}

      <div className="admin-card">
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center' }}>Đang tải người dùng...</div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Elo (Cup)</th>
                  <th>Cấp</th>
                  <th>Ngày tạo</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>
                      Không tìm thấy người dùng nào.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <img
                            src={u.avatarUrl || '/icons.svg#user'}
                            alt={u.displayName}
                            style={{ width: 32, height: 32, borderRadius: '50%' }}
                            onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                          />
                          <strong>{u.displayName}</strong>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span
                          className={`badge ${
                            u.role.toLowerCase() === 'admin' ? 'badge-admin' : 'badge-user'
                          }`}
                        >
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${u.status.toLowerCase()}`}>
                          {u.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'var(--green)' }}>{u.elo}</strong>
                      </td>
                      <td>Lv.{u.playerLevel}</td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="admin-actions-cell">
                        <div className="admin-actions-group">
                          {u.status.toLowerCase() === 'banned' ? (
                            <button
                              className="admin-btn admin-btn-secondary"
                              style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                              onClick={() => handleUnbanUser(u)}
                              disabled={actionLoading}
                            >
                              Mở khóa
                            </button>
                          ) : (
                            <button
                              className="admin-btn admin-btn-danger"
                              style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                              onClick={() => {
                                setSelectedUser(u)
                                setBanModalOpen(true)
                              }}
                              disabled={actionLoading || u.status.toLowerCase() === 'deleted'}
                            >
                              Khóa
                            </button>
                          )}

                          <button
                            className="admin-btn admin-btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '0.8rem' }}
                            onClick={() => {
                              setSelectedUser(u)
                              setEloModalOpen(true)
                            }}
                            disabled={actionLoading}
                          >
                            Chỉnh Elo
                          </button>

                          {u.status.toLowerCase() !== 'deleted' && (
                            <button
                              className="admin-btn admin-btn-danger"
                              style={{ padding: '5px 10px', fontSize: '0.8rem', opacity: 0.88 }}
                              onClick={() => {
                                setSelectedUser(u)
                                setDeleteModalOpen(true)
                              }}
                              disabled={actionLoading}
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}>
        <button
          className="admin-btn admin-btn-secondary"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          Trước
        </button>
        <span>
          Trang {page} / {totalPages}
        </span>
        <button
          className="admin-btn admin-btn-secondary"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Sau
        </button>
      </div>

      {/* Ban Modal */}
      {banModalOpen && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Khóa người dùng: {selectedUser.displayName}</h3>
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setBanModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="alert-warning">
                ⚠️ Người dùng sẽ bị thu hồi phiên đăng nhập và nhận được thông báo giải thích lý do
                khóa tài khoản.
              </div>
              <div className="form-group">
                <label>Lý do khóa (Bắt buộc):</label>
                <textarea
                  placeholder="Ví dụ: Sử dụng tool gian lận ván đấu #1234..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Khóa đến ngày (Để trống = Khóa vĩnh viễn):</label>
                <input
                  type="datetime-local"
                  value={bannedUntil}
                  onChange={(e) => setBannedUntil(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setBanModalOpen(false)}
              >
                Hủy
              </button>
              <button
                className="admin-btn admin-btn-danger"
                onClick={handleBanUser}
                disabled={actionLoading || !banReason.trim()}
              >
                {actionLoading ? 'Đang xử lý...' : 'Xác nhận khóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elo Modal */}
      {eloModalOpen && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Điều chỉnh Elo: {selectedUser.displayName}</h3>
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setEloModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="alert-warning">
                Điểm Elo hiện tại: <strong>{selectedUser.elo}</strong>. Người dùng sẽ nhận được
                thông báo về thay đổi này.
              </div>
              <div className="form-group">
                <label>Thao tác:</label>
                <select
                  value={eloOperation}
                  onChange={(e) => setEloOperation(e.target.value)}
                >
                  <option value="ADD">Cộng điểm (ADD)</option>
                  <option value="SUBTRACT">Trừ điểm (SUBTRACT)</option>
                  <option value="SET">Thiết lập điểm cố định (SET)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Giá trị điểm:</label>
                <input
                  type="number"
                  min="0"
                  value={eloDelta}
                  onChange={(e) => setEloDelta(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>Lý do điều chỉnh (Bắt buộc):</label>
                <textarea
                  placeholder="Ví dụ: Đền bù điểm lỗi disconnect máy chủ..."
                  value={eloReason}
                  onChange={(e) => setEloReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setEloModalOpen(false)}
              >
                Hủy
              </button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={handleAdjustElo}
                disabled={actionLoading || !eloReason.trim()}
              >
                {actionLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Xóa mềm người dùng: {selectedUser.displayName}</h3>
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setDeleteModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="alert-warning">
                Tài khoản sẽ được chuyển sang trạng thái DELETED và không thể tiếp tục đăng nhập.
              </p>
              <div className="form-group">
                <label>Lý do xóa (Bắt buộc):</label>
                <textarea
                  placeholder="Nhập lý do xóa tài khoản..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setDeleteModalOpen(false)}
              >
                Hủy
              </button>
              <button
                className="admin-btn admin-btn-danger"
                onClick={handleDeleteUser}
                disabled={actionLoading || !deleteReason.trim()}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {auditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 750, maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>Lịch sử Audit Log</h3>
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setAuditModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {auditLoading ? (
                <div>Đang tải logs...</div>
              ) : auditLogs.length === 0 ? (
                <div>Chưa có nhật ký ghi nhận.</div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Hành động</th>
                      <th>Lý do</th>
                      <th>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((l) => (
                      <tr key={l.id}>
                        <td style={{ fontSize: '0.8rem' }}>
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                        <td>
                          <strong>{l.action}</strong>
                        </td>
                        <td>{l.reason}</td>
                        <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          <div>Trước: {l.beforeJson}</div>
                          <div>Sau: {l.afterJson}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => setAuditModalOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
