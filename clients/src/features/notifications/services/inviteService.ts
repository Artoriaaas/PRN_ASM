import { auth } from '../../../auth/firebase'
import { getDevToken } from '../../../auth/devAuth'
import type { InviteService } from './types'
import { loadMockNotifications, saveMockNotifications } from './mockData'

async function getAuthToken(): Promise<string> {
  const user = auth.currentUser
  if (user) {
    try {
      return await user.getIdToken()
    } catch {
      return await getDevToken()
    }
  }
  return await getDevToken()
}

export class MockInviteService implements InviteService {
  private delay(ms = 350): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async respond(inviteId: string, accept: boolean): Promise<{ roomCode?: string }> {
    await this.delay()
    const all = loadMockNotifications()
    const target = all.find((n) => n.payload.type === 'MATCH_INVITE' && n.payload.inviteId === inviteId)

    const roomCode = accept ? `RM-${Math.floor(1000 + Math.random() * 9000)}` : undefined

    if (target && target.payload.type === 'MATCH_INVITE') {
      target.payload.status = accept ? 'ACCEPTED' : 'DECLINED'
      if (roomCode) {
        target.payload.roomCode = roomCode
      }
      target.isRead = true
      saveMockNotifications(all)
    }

    return accept ? { roomCode } : {}
  }
}

export class ApiInviteService implements InviteService {
  private baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

  async respond(inviteId: string, accept: boolean): Promise<{ roomCode?: string }> {
    const token = await getAuthToken()
    const res = await fetch(`${this.baseUrl}/api/match/invites/${inviteId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ accept }),
    })

    if (!res.ok) {
      throw new Error(`Lỗi phản hồi lời mời (${res.status})`)
    }

    return res.json() as Promise<{ roomCode?: string }>
  }
}

let mockInviteInstance: MockInviteService | null = null
let apiInviteInstance: ApiInviteService | null = null

export function getInviteService(): InviteService {
  const mode = import.meta.env.VITE_NOTIFICATIONS_MODE ?? 'mock'
  if (mode === 'api') {
    if (!apiInviteInstance) apiInviteInstance = new ApiInviteService()
    return apiInviteInstance
  }
  if (!mockInviteInstance) mockInviteInstance = new MockInviteService()
  return mockInviteInstance
}

