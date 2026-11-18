import { getApiBase } from './apiBase'
import { getJsonAuthHeaders as getAuthHeaders } from '../auth/accessToken'

/** Base URL backend — xem `apiBase.ts` ('' = same-origin). */
const BASE_URL = getApiBase()

export type FeedbackMessage = {
  id: string
  ticketId: string
  senderId: string
  senderRole: 'USER' | 'ADMIN'
  content: string
  createdAt: string
}

export type FeedbackStatusHistory = {
  oldStatus: string
  newStatus: string
  reason: string
  createdAt: string
}

export type FeedbackTicket = {
  id: string
  userId: string
  type: string
  title: string
  status: string
  assignedAdminId?: string | null
  relatedMatchId?: string | null
  createdAt: string
  updatedAt: string
  messages?: FeedbackMessage[]
  statusHistory?: FeedbackStatusHistory[]
}

export type NotificationItem = {
  id: string
  userId: string
  type: string
  title: string
  body: string
  refId?: string | null
  isRead: boolean
  createdAt: string
}

export type PagedResult<T> = {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

type ApiProblem = {
  detail?: string
  error?: string
  title?: string
}

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const problem = (await response.json().catch(() => null)) as ApiProblem | null
  return problem?.detail || problem?.error || problem?.title || fallback
}


export async function submitFeedback(input: {
  type: string
  title: string
  content: string
  relatedMatchId?: string
}): Promise<FeedbackTicket> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/api/v1/feedback`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, 'Lỗi khi gửi phản hồi'))
  }
  return res.json()
}


export async function getUserTickets(
  page = 1,
  pageSize = 20,
  signal?: AbortSignal,
): Promise<PagedResult<FeedbackTicket>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/api/v1/feedback?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
    headers,
    signal,
  })
  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, 'Không thể tải danh sách phản hồi'))
  }
  return res.json()
}


export async function getTicketDetail(id: string, signal?: AbortSignal): Promise<FeedbackTicket> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/api/v1/feedback/${id}`, {
    method: 'GET',
    headers,
    signal,
  })
  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, 'Không thể tải chi tiết phản hồi'))
  }
  return res.json()
}


export async function addFeedbackMessage(
  ticketId: string,
  content: string,
): Promise<FeedbackMessage> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/api/v1/feedback/${ticketId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, 'Lỗi gửi tin nhắn'))
  }
  return res.json()
}

export const replyTicket = addFeedbackMessage


// Admin Feedback API
export async function adminGetFeedbackQueue(
  params: {
    page?: number
    pageSize?: number
    status?: string
    type?: string
    search?: string
  },
  signal?: AbortSignal,
): Promise<PagedResult<FeedbackTicket>> {
  const headers = await getAuthHeaders()
  const q = new URLSearchParams()
  if (params.page) q.set('page', params.page.toString())
  if (params.pageSize) q.set('pageSize', params.pageSize.toString())
  if (params.status) q.set('status', params.status)
  if (params.type) q.set('type', params.type)
  if (params.search) q.set('search', params.search)

  const res = await fetch(`${BASE_URL}/api/v1/admin/feedback?${q.toString()}`, {
    method: 'GET',
    headers,
    signal,
  })
  if (!res.ok) {
    throw new Error(
      await getApiErrorMessage(res, `Không thể tải hàng đợi phản hồi (${res.status})`),
    )
  }
  return res.json()
}


export async function adminGetTicketDetail(
  id: string,
  signal?: AbortSignal,
): Promise<FeedbackTicket> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/api/v1/admin/feedback/${id}`, {
    method: 'GET',
    headers,
    signal,
  })
  if (!res.ok) {
    throw new Error(
      await getApiErrorMessage(res, `Không thể tải chi tiết phản hồi (${res.status})`),
    )
  }
  return res.json()
}


export async function adminReplyFeedback(
  ticketId: string,
  content: string,
  reason: string,
): Promise<FeedbackMessage> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/api/v1/admin/feedback/${ticketId}/reply`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, reason }),
  })
  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, 'Lỗi khi phản hồi ticket'))
  }
  return res.json()
}


export async function adminChangeStatus(
  ticketId: string,
  status: string,
  reason: string,
): Promise<FeedbackTicket> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/api/v1/admin/feedback/${ticketId}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status, reason }),
  })
  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, 'Lỗi đổi trạng thái'))
  }
  return res.json()
}


export async function adminAssignFeedback(
  ticketId: string,
  adminId: string | null,
  reason: string,
): Promise<FeedbackTicket> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/api/v1/admin/feedback/${ticketId}/assign`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ adminId, reason }),
  })
  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, 'Lỗi gán ticket'))
  }
  return res.json()
}


// Notifications API
export async function getNotifications(
  page = 1,
  pageSize = 20,
  signal?: AbortSignal,
): Promise<PagedResult<NotificationItem>> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/api/v1/notifications?page=${page}&pageSize=${pageSize}`, {
    method: 'GET',
    headers,
    signal,
  })
  if (!res.ok) {
    throw new Error(await getApiErrorMessage(res, 'Không thể tải thông báo'))
  }
  return res.json()
}


export async function markNotificationRead(id: string): Promise<boolean> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/api/v1/notifications/${id}/read`, {
    method: 'PATCH',
    headers,
  })
  return res.ok
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BASE_URL}/api/v1/notifications/read-all`, {
    method: 'PATCH',
    headers,
  })
  return res.ok
}
