import * as signalR from '@microsoft/signalr'
import { getAbsoluteApiUrl } from '../../../api/apiBase'
import { getAccessToken } from '../../../auth/accessToken'
import type { AppNotification, InviteStatus, NotificationRealtime, RealtimeHandlers } from './types'

const getAuthToken = getAccessToken

export class MockRealtime implements NotificationRealtime {
  private subscribers = new Set<RealtimeHandlers>()

  subscribe(handlers: RealtimeHandlers): () => void {
    this.subscribers.add(handlers)
    return () => {
      this.subscribers.delete(handlers)
    }
  }

  emitInvite(notification: AppNotification): void {
    for (const h of this.subscribers) {
      try {
        h.onInviteReceived(notification)
      } catch (err) {
        console.error('MockRealtime onInviteReceived handler error', err)
      }
    }
  }

  emitInviteChanged(inviteId: string, status: InviteStatus, roomCode?: string): void {
    for (const h of this.subscribers) {
      try {
        h.onInviteChanged(inviteId, status, roomCode)
      } catch (err) {
        console.error('MockRealtime onInviteChanged handler error', err)
      }
    }
  }
}

export class SignalRRealtime implements NotificationRealtime {
  private hubUrl = getAbsoluteApiUrl('/hubs/multiplayer')
  private connection: signalR.HubConnection | null = null
  private subscribers = new Set<RealtimeHandlers>()
  private isConnecting = false

  private async ensureConnected(): Promise<void> {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return
    }
    if (this.isConnecting) return

    this.isConnecting = true
    try {
      if (!this.connection) {
        this.connection = new signalR.HubConnectionBuilder()
          .withUrl(this.hubUrl, {
            accessTokenFactory: async () => (await getAuthToken()) ?? '',
          })
          .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
          .configureLogging(signalR.LogLevel.Warning)
          .build()

        this.connection.on('InviteReceived', (data: AppNotification) => {
          for (const s of this.subscribers) {
            s.onInviteReceived(data)
          }
        })

        this.connection.on(
          'InviteChanged',
          (payload: { inviteId: string; status: InviteStatus; roomCode?: string }) => {
            for (const s of this.subscribers) {
              s.onInviteChanged(payload.inviteId, payload.status, payload.roomCode)
            }
          },
        )
      }

      await this.connection.start()
    } catch (err) {
      console.warn('SignalRRealtime connection failed (will retry or ignore in mock/offline)', err)
    } finally {
      this.isConnecting = false
    }
  }

  subscribe(handlers: RealtimeHandlers): () => void {
    this.subscribers.add(handlers)
    void this.ensureConnected()

    return () => {
      this.subscribers.delete(handlers)
      if (this.subscribers.size === 0 && this.connection) {
        void this.connection.stop()
        this.connection = null
      }
    }
  }
}

let mockRealtimeInstance: MockRealtime | null = null
let signalRRealtimeInstance: SignalRRealtime | null = null

export function getNotificationRealtime(): NotificationRealtime {
  const mode = import.meta.env.VITE_NOTIFICATIONS_MODE ?? 'mock'
  if (mode === 'api') {
    if (!signalRRealtimeInstance) signalRRealtimeInstance = new SignalRRealtime()
    return signalRRealtimeInstance
  }
  if (!mockRealtimeInstance) mockRealtimeInstance = new MockRealtime()
  return mockRealtimeInstance
}

export function getMockRealtime(): MockRealtime {
  if (!mockRealtimeInstance) mockRealtimeInstance = new MockRealtime()
  return mockRealtimeInstance
}

