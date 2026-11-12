import * as signalR from '@microsoft/signalr'
import { auth } from '../auth/firebase'
import { getDevToken } from '../auth/devAuth'
import { LayoutType } from '../gen/sudoku/game/v1/game_pb'
import { PlayFormat, BoardLayoutType, MatchResult } from '../gen/sudoku/multi/v1/multi_pb'
import {
  getCachedRatingsSync,
  resolveLevelFromElo,
  updateLocalEloRating,
} from '../api/multiClient'
import { createOfflineSession, getOfflineSolution } from '../lib/offlineSudoku'
import { getPeers, STANDARD_REGION_MAP } from '../lib/board'

export type MatchPlayerSummary = {
  userId: string
  displayName: string
  avatarUrl?: string
  rating: number
  turnOrder: number
  lives: number
}

export type MatchRulesPayload = {
  lives: number
  turnSeconds: number
  wrongTimePenaltySeconds: number
  matchTimeLimitSeconds: number
  reconnectGraceSeconds: number
  countdownSeconds: number
  preparationSeconds?: number
}

export type MatchStartedPayload = {
  matchId: string
  roomCode?: string
  playFormat: number // 1 = Race, 2 = Duel
  boardLayout: number // 1 = Standard, 2 = Irregular
  levelId: string
  initial: string
  regionMap: string
  rules: MatchRulesPayload
  startedAt: string
  currentTurnUserId: string
  turn: number
  turnDeadline: string
  player1: MatchPlayerSummary
  player2: MatchPlayerSummary
  isSimulated?: boolean
  isPreparationPhase?: boolean
  preparationDeadline?: string
  preparationSeconds?: number
  player1Ready?: boolean
  player2Ready?: boolean
}

export type CustomRoomCreatedPayload = {
  roomCode: string
  format: number
  layout: number
  level: string
  hostUserId: string
  hostDisplayName: string
  hostRating: number
  createdAt: string
  isSimulated?: boolean
}

export type MoveResultPayload = {
  matchId: string
  userId: string
  i: number
  v: number
  ok: boolean
  isDuplicateWrong?: boolean
  tier?: number
  points?: number
  score: number
  lives: number
  mistakes: number
  penaltySec?: number
  progressPercent?: number
  revealedWrongDigits?: number[]
}

export type OpponentProgressPayload = {
  matchId: string
  userId: string
  filled: number
  mistakes: number
  lives: number
  penaltySec: number
  progressPercent: number
}

export type TurnChangedPayload = {
  matchId: string
  userId: string
  turn: number
  deadline: string
}

export type MatchEndedPlayerStats = {
  result: number
  ratingBefore: number
  eloDelta: number
  newRating: number
  score: number
  lives: number
  mistakes: number
}

export type PlayerReadyChangedPayload = {
  matchId: string
  userId: string
  player1Ready: boolean
  player2Ready: boolean
}

export type PreparationEndedPayload = {
  matchId: string
  startedAt: string
  currentTurnUserId: string
  turn: number
  turnDeadline: string
}

export type MatchEndedPayload = {
  matchId: string
  playFormat: number
  boardLayout: number
  levelId: string
  isDraw: boolean
  winnerUserId: string
  reason: string
  durationMs: number
  player1: MatchEndedPlayerStats
  player2: MatchEndedPlayerStats
}

export type RoomStateSyncedPayload = {
  matchId: string
  playFormat: number
  boardLayout: number
  levelId: string
  initial: string
  regionMap: string
  myBoard: string
  notes: Record<number, number>
  myLives: number
  myMistakes: number
  myScore: number
  myPenaltySec: number
  myProgressPercent: number
  opponent: {
    userId: string
    displayName: string
    lives: number
    mistakes: number
    score: number
    filled: number
    progressPercent: number
    isDisconnected: boolean
  }
  currentTurnUserId: string
  turn: number
  turnDeadline: string
  startedAt: string
  matchDeadline: string
  revealedWrongDigits: Record<number, number[]>
  isPreparationPhase?: boolean
  preparationDeadline?: string
  player1Ready?: boolean
  player2Ready?: boolean
}

type Listener<T> = (payload: T) => void

const BOT_NAMES = [
  'Minh Quân',
  'Hoàng Anh',
  'Thanh Tùng',
  'Bảo Ngọc',
  'Đức Thịnh',
  'Khánh Linh',
  'Gia Huy',
  'Phương Thảo',
]

const ACTIVE_MATCH_STORAGE_KEY = 'sudoku:multi:activeMatch'
const LAST_RESULT_STORAGE_KEY = 'sudoku:multi:lastResult'
const CUSTOM_ROOMS_STORAGE_KEY = 'sudoku:multi:customRooms'

type StoredCustomRoom = CustomRoomCreatedPayload & {
  initial?: string
  solution?: string
  regionMap?: string
}

class MatchHubClientManager {
  private connection: signalR.HubConnection | null = null
  private connectPromise: Promise<boolean> | null = null
  private isServerOnline = false

  private matchFoundListeners = new Set<Listener<MatchStartedPayload>>()
  private customRoomCreatedListeners = new Set<Listener<CustomRoomCreatedPayload>>()
  private moveResultListeners = new Set<Listener<MoveResultPayload>>()
  private opponentProgressListeners = new Set<Listener<OpponentProgressPayload>>()
  private turnChangedListeners = new Set<Listener<TurnChangedPayload>>()
  private matchEndedListeners = new Set<Listener<MatchEndedPayload>>()
  private roomStateSyncedListeners = new Set<Listener<RoomStateSyncedPayload>>()
  private opponentDisconnectedListeners = new Set<
    Listener<{ matchId: string; userId: string; graceSeconds: number; deadline: string }>
  >()
  private opponentReconnectedListeners = new Set<Listener<{ matchId: string; userId: string }>>()
  private playerReadyListeners = new Set<Listener<PlayerReadyChangedPayload>>()
  private preparationEndedListeners = new Set<Listener<PreparationEndedPayload>>()

  // Simulation / Fallback runtime state
  private queueTimer: number | undefined = undefined
  private botInterval: number | undefined = undefined
  private turnTimer: number | undefined = undefined
  private simSolutionMap = new Map<string, string>()
  private simSharedBoardMap = new Map<string, string>()
  private simPlayerBoardMap = new Map<string, string>()
  private simWrongMovesMap = new Map<string, Set<string>>()
  private simRevealedWrongMap = new Map<string, Record<number, number[]>>()
  private simStateMap = new Map<
    string,
    {
      payload: MatchStartedPayload
      myLives: number
      myMistakes: number
      myScore: number
      myPenaltySec: number
      myCorrect: number
      oppLives: number
      oppMistakes: number
      oppScore: number
      oppPenaltySec: number
      oppCorrect: number
      totalEmpty: number
      turn: number
      currentTurnUserId: string
      turnDeadlineMs: number
      finished: boolean
    }
  >()
  private channel: BroadcastChannel | null = null

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('sudoku-multiplayer-bus')
      this.channel.onmessage = (event) => {
        const msg = event.data
        if (!msg || typeof msg !== 'object') return
        if (msg.type === 'CUSTOM_ROOM_CREATED') {
          const room = msg.room as StoredCustomRoom
          const currentRooms = this.getStoredCustomRooms()
          currentRooms[room.roomCode] = room
          localStorage.setItem(CUSTOM_ROOMS_STORAGE_KEY, JSON.stringify(currentRooms))
        } else if (msg.type === 'CUSTOM_ROOM_MATCH_STARTED') {
          const payload = msg.payload as MatchStartedPayload
          const solution = msg.solution as string | undefined
          const currentUid = this.getCallerIdentity().userId
          if (
            payload.player1.userId === currentUid ||
            payload.player2.userId === currentUid
          ) {
            if (solution) {
              this.simSolutionMap.set(payload.matchId, solution)
            }
            this.initSimulatedMatchRuntime(payload)
            this.saveActiveMatch(payload)
            this.emitMatchFound(payload)
          }
        } else if (msg.type === 'CROSS_TAB_MOVE') {
          this.handleCrossTabMove(msg.matchId, msg.outcome)
        } else if (msg.type === 'CROSS_TAB_MATCH_ENDED') {
          const summary = msg.payload as MatchEndedPayload
          this.saveMatchResult(summary)
          this.emitMatchEnded(summary)
        }
      }
    }
  }

  public getCallerIdentity(fallbackName?: string): {
    userId: string
    displayName: string
    avatarUrl: string
  } {
    const user = auth.currentUser
    if (user) {
      return {
        userId: user.uid,
        displayName:
          fallbackName ||
          user.displayName ||
          user.email?.split('@')[0] ||
          `Player-${user.uid.slice(0, 5)}`,
        avatarUrl: user.photoURL || '',
      }
    }

    // Generate or retrieve persistent guest UID for this tab/browser
    let guestUid = sessionStorage.getItem('sudoku:guest:uid')
    if (!guestUid) {
      guestUid = `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      sessionStorage.setItem('sudoku:guest:uid', guestUid)
    }

    return {
      userId: guestUid,
      displayName: fallbackName || `Khách-${guestUid.slice(-4)}`,
      avatarUrl: '',
    }
  }
  public async ensureConnected(): Promise<boolean> {
    if (
      this.connection &&
      this.connection.state === signalR.HubConnectionState.Connected
    ) {
      this.isServerOnline = true
      return true
    }

    if (this.connectPromise) {
      return this.connectPromise
    }

    this.connectPromise = (async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
        const conn = new signalR.HubConnectionBuilder()
          .withUrl(`${baseUrl}/hubs/match`, {
            accessTokenFactory: async () => {
              const user = auth.currentUser
              if (user) {
                try {
                  return await user.getIdToken()
                } catch {
                  const caller = this.getCallerIdentity()
                  return await getDevToken(caller.userId)
                }
              }
              const caller = this.getCallerIdentity()
              return await getDevToken(caller.userId)
            },
          })
          .withAutomaticReconnect([0, 1000, 2000, 5000])
          .configureLogging(signalR.LogLevel.Warning)
          .build()

        this.bindConnectionEvents(conn)

        const { promise: timeoutPromise, reject: rejectTimeout } = Promise.withResolvers<never>()
        const connectTimer = window.setTimeout(
          () => rejectTimeout(new Error('SignalR connection timeout')),
          2500,
        )

        try {
          await Promise.race([conn.start(), timeoutPromise])
        } finally {
          clearTimeout(connectTimer)
        }
        this.connection = conn
        this.isServerOnline = true
        return true
      } catch {
        this.isServerOnline = false
        return false
      } finally {
        this.connectPromise = null
      }
    })()

    return this.connectPromise
  }

  private bindConnectionEvents(conn: signalR.HubConnection) {
    conn.off('MatchFound')
    conn.off('MatchStarted')
    conn.off('CustomRoomCreated')
    conn.off('MoveResult')
    conn.off('OpponentProgress')
    conn.off('TurnChanged')
    conn.off('MatchEnded')
    conn.off('RoomStateSynced')
    conn.off('OpponentDisconnected')
    conn.off('OpponentReconnected')
    conn.off('PlayerReadyChanged')
    conn.off('PreparationEnded')

    let lastMatchIdEmitted = ''
    const handleMatchStart = (payload: MatchStartedPayload) => {
      if (payload.matchId === lastMatchIdEmitted) return
      lastMatchIdEmitted = payload.matchId
      this.saveActiveMatch(payload)
      this.emitMatchFound(payload)
    }

    conn.on('MatchFound', handleMatchStart)
    conn.on('MatchStarted', handleMatchStart)

    conn.on('CustomRoomCreated', (payload: CustomRoomCreatedPayload) => {
      this.customRoomCreatedListeners.forEach((cb) => cb(payload))
    })

    conn.on('MoveResult', (payload: MoveResultPayload) => {
      this.moveResultListeners.forEach((cb) => cb(payload))
    })

    conn.on('OpponentProgress', (payload: OpponentProgressPayload) => {
      this.opponentProgressListeners.forEach((cb) => cb(payload))
    })

    conn.on('TurnChanged', (payload: TurnChangedPayload) => {
      this.turnChangedListeners.forEach((cb) => cb(payload))
    })

    conn.on('MatchEnded', (payload: MatchEndedPayload) => {
      this.saveMatchResult(payload)
      this.emitMatchEnded(payload)
    })

    conn.on('RoomStateSynced', (payload: RoomStateSyncedPayload) => {
      this.roomStateSyncedListeners.forEach((cb) => cb(payload))
    })

    conn.on('OpponentDisconnected', (payload) => {
      this.opponentDisconnectedListeners.forEach((cb) => cb(payload))
    })

    conn.on('OpponentReconnected', (payload) => {
      this.opponentReconnectedListeners.forEach((cb) => cb(payload))
    })
    conn.on('PlayerReadyChanged', (payload: PlayerReadyChangedPayload) => {
      this.playerReadyListeners.forEach((cb) => cb(payload))
    })

    conn.on('PreparationEnded', (payload: PreparationEndedPayload) => {
      this.preparationEndedListeners.forEach((cb) => cb(payload))
    })

    conn.onreconnected(() => {
      const active = this.getActiveMatch()
      if (active && !active.isSimulated) {
        conn.invoke('SyncRoomState', { matchId: active.matchId }).catch(() => {})
      }
    })
  }

  public async joinQueue(params: {
    format: PlayFormat
    layout: BoardLayoutType
    level?: string
    displayName?: string
  }): Promise<void> {
    this.clearTimers()
    const online = await this.ensureConnected()
    const ratings = getCachedRatingsSync()
    const myRating = params.format === PlayFormat.DUEL ? ratings.duel : ratings.race
    const autoLevel = params.level || resolveLevelFromElo(myRating).levelId

    if (online && this.connection) {
      try {
        await this.connection.invoke('JoinQueue', {
          playFormat: params.format,
          boardLayout: params.layout,
          levelId: autoLevel,
        })
        return
      } catch {
        // Fallback to simulated queue
      }
    }

    // Simulated matchmaking when backend is offline: pair after 2.6 seconds
    this.queueTimer = window.setTimeout(() => {
      this.startSimulatedMatch({
        format: params.format,
        layout: params.layout,
        levelId: autoLevel,
        displayName: params.displayName,
      })
    }, 2600)
  }

  public async leaveQueue(): Promise<void> {
    this.clearTimers()
    if (this.isServerOnline && this.connection) {
      try {
        await this.connection.invoke('LeaveQueue')
      } catch {
        // ignore
      }
    }
  }

  public async createCustomRoom(params: {
    format: PlayFormat
    layout: BoardLayoutType
    level: string
    displayName?: string
  }): Promise<CustomRoomCreatedPayload> {
    this.clearTimers()
    const online = await this.ensureConnected()
    if (online && this.connection) {
      try {
        const {
          promise: createdPromise,
          resolve: resolveCreated,
          reject: rejectCreated,
        } = Promise.withResolvers<CustomRoomCreatedPayload>()
        const timer = window.setTimeout(() => {
          unsub()
          rejectCreated(new Error('Timeout waiting for CustomRoomCreated'))
        }, 3000)
        const unsub = this.onCustomRoomCreated((p) => {
          clearTimeout(timer)
          unsub()
          resolveCreated(p)
        })
        await this.connection.invoke('CreateCustomRoom', {
          playFormat: params.format,
          boardLayout: params.layout,
          levelId: params.level,
        })
        return await createdPromise
      } catch {
        // Fallback to local/BroadcastChannel room creation
      }
    }

    const caller = this.getCallerIdentity(params.displayName)
    const ratings = getCachedRatingsSync()
    const hostRating = params.format === PlayFormat.DUEL ? ratings.duel : ratings.race
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let roomCode = ''
    for (let i = 0; i < 6; i++) {
      roomCode += alphabet[Math.floor(Math.random() * alphabet.length)]
    }

    const offlineSession = createOfflineSession(
      params.level,
      params.layout === BoardLayoutType.IRREGULAR ? LayoutType.IRREGULAR : LayoutType.STANDARD,
    )
    const solution = getOfflineSolution(offlineSession.sessionId) ?? ''

    const payload: StoredCustomRoom = {
      roomCode,
      format: params.format,
      layout: params.layout,
      level: params.level,
      hostUserId: caller.userId,
      hostDisplayName: caller.displayName,
      hostRating,
      createdAt: new Date().toISOString(),
      isSimulated: true,
      initial: offlineSession.initialBoard,
      solution,
      regionMap: offlineSession.regionMap,
    }

    const rooms = this.getStoredCustomRooms()
    rooms[roomCode] = payload
    localStorage.setItem(CUSTOM_ROOMS_STORAGE_KEY, JSON.stringify(rooms))
    this.channel?.postMessage({
      type: 'CUSTOM_ROOM_CREATED',
      room: payload,
    })

    this.customRoomCreatedListeners.forEach((cb) => cb(payload))
    return payload
  }

  public async joinCustomRoom(
    roomCode: string,
    displayName?: string,
  ): Promise<void> {
    const normalized = roomCode.trim().toUpperCase()
    if (normalized.length !== 6) {
      throw new Error('Mã phòng phải gồm đúng 6 ký tự.')
    }

    const online = await this.ensureConnected()
    if (online && this.connection) {
      try {
        await this.connection.invoke('JoinCustomRoom', { roomCode: normalized })
        return
      } catch (err) {
        // Check if room exists in local cross-tab storage before rethrowing
        const rooms = this.getStoredCustomRooms()
        if (!rooms[normalized]) {
          const msg = err instanceof Error ? err.message : 'Không tìm thấy phòng hoặc phòng đã bắt đầu.'
          throw new Error(msg)
        }
      }
    }

    const rooms = this.getStoredCustomRooms()
    const room = rooms[normalized]
    if (!room) {
      throw new Error(`Phòng '${normalized}' không tồn tại hoặc đã bắt đầu.`)
    }

    delete rooms[normalized]
    localStorage.setItem(CUSTOM_ROOMS_STORAGE_KEY, JSON.stringify(rooms))

    const caller = this.getCallerIdentity(displayName)
    const guestUid =
      caller.userId === room.hostUserId ? `${caller.userId}-guest` : caller.userId
    const ratings = getCachedRatingsSync()
    const guestRating = room.format === PlayFormat.DUEL ? ratings.duel : ratings.race

    const offlineSession = createOfflineSession(
      room.level,
      room.layout === BoardLayoutType.IRREGULAR ? LayoutType.IRREGULAR : LayoutType.STANDARD,
    )
    const initial = room.initial || offlineSession.initialBoard
    const solution = room.solution || getOfflineSolution(offlineSession.sessionId) || ''
    const regionMap = room.regionMap || offlineSession.regionMap || STANDARD_REGION_MAP

    const matchId = `custom-${Date.now()}-${normalized.toLowerCase()}`
    const startedAt = new Date(Date.now() + 5000).toISOString()
    const turnDeadline = new Date(Date.now() + 5000 + 15000).toISOString()

    const payload: MatchStartedPayload = {
      matchId,
      roomCode: normalized,
      playFormat: room.format,
      boardLayout: room.layout,
      levelId: room.level,
      initial,
      regionMap,
      rules: {
        lives: 3,
        turnSeconds: 15,
        wrongTimePenaltySeconds: 10,
        matchTimeLimitSeconds: 900,
        reconnectGraceSeconds: 30,
        countdownSeconds: 5,
      },
      startedAt,
      currentTurnUserId: room.hostUserId,
      turn: 1,
      turnDeadline,
      player1: {
        userId: room.hostUserId,
        displayName: room.hostDisplayName,
        rating: room.hostRating,
        turnOrder: 1,
        lives: 3,
      },
      player2: {
        userId: guestUid,
        displayName: caller.displayName,
        rating: guestRating,
        turnOrder: 2,
        lives: 3,
      },
      isSimulated: true,
    }

    this.simSolutionMap.set(matchId, solution)
    this.initSimulatedMatchRuntime(payload)
    this.saveActiveMatch(payload)
    this.channel?.postMessage({
      type: 'CUSTOM_ROOM_MATCH_STARTED',
      payload,
      solution,
    })
    this.emitMatchFound(payload)
  }

  public async leaveCustomRoom(roomCode?: string): Promise<void> {
    if (roomCode) {
      const rooms = this.getStoredCustomRooms()
      delete rooms[roomCode.toUpperCase()]
      localStorage.setItem(CUSTOM_ROOMS_STORAGE_KEY, JSON.stringify(rooms))
    }
    if (this.isServerOnline && this.connection) {
      try {
        await this.connection.invoke('LeaveCustomRoom', { roomCode })
      } catch {
        // ignore
      }
    }
  }

  public startSimulatedMatch(params: {
    format: PlayFormat
    layout: BoardLayoutType
    levelId: string
    displayName?: string
    roomCode?: string
    opponentName?: string
  }): MatchStartedPayload {
    this.clearTimers()
    const caller = this.getCallerIdentity(params.displayName)
    const ratings = getCachedRatingsSync()
    const myRating = params.format === PlayFormat.DUEL ? ratings.duel : ratings.race
    const botDelta = Math.floor(Math.random() * 60) - 30
    const botRating = Math.max(800, myRating + botDelta)
    const botName =
      params.opponentName || BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]

    const offlineSession = createOfflineSession(
      params.levelId,
      params.layout === BoardLayoutType.IRREGULAR ? LayoutType.IRREGULAR : LayoutType.STANDARD,
    )
    const solution = getOfflineSolution(offlineSession.sessionId) ?? ''
    const matchId = `match-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const startedAtMs = Date.now() + 5000
    const startedAt = new Date(startedAtMs).toISOString()
    const turnDeadline = new Date(startedAtMs + 15000).toISOString()

    const payload: MatchStartedPayload = {
      matchId,
      roomCode: params.roomCode || '',
      playFormat: params.format,
      boardLayout: params.layout,
      levelId: params.levelId,
      initial: offlineSession.initialBoard,
      regionMap: offlineSession.regionMap || STANDARD_REGION_MAP,
      rules: {
        lives: 3,
        turnSeconds: 15,
        wrongTimePenaltySeconds: 10,
        matchTimeLimitSeconds: 900,
        reconnectGraceSeconds: 30,
        countdownSeconds: 5,
      },
      startedAt,
      currentTurnUserId: caller.userId,
      turn: 1,
      turnDeadline,
      player1: {
        userId: caller.userId,
        displayName: caller.displayName,
        avatarUrl: caller.avatarUrl,
        rating: myRating,
        turnOrder: 1,
        lives: 3,
      },
      player2: {
        userId: 'bot-opponent',
        displayName: botName,
        rating: botRating,
        turnOrder: 2,
        lives: 3,
      },
      isSimulated: true,
    }

    this.simSolutionMap.set(matchId, solution)
    this.initSimulatedMatchRuntime(payload)
    this.saveActiveMatch(payload)
    this.emitMatchFound(payload)
    return payload
  }

  private initSimulatedMatchRuntime(payload: MatchStartedPayload) {
    let totalEmpty = 0
    for (let i = 0; i < 81; i++) {
      if (payload.initial[i] === '0' || payload.initial[i] === '.') totalEmpty++
    }
    this.simSharedBoardMap.set(payload.matchId, payload.initial)
    this.simPlayerBoardMap.set(payload.matchId, payload.initial)
    this.simWrongMovesMap.set(payload.matchId, new Set<string>())
    this.simRevealedWrongMap.set(payload.matchId, {})
    this.simStateMap.set(payload.matchId, {
      payload,
      myLives: payload.rules.lives,
      myMistakes: 0,
      myScore: 0,
      myPenaltySec: 0,
      myCorrect: 0,
      oppLives: payload.rules.lives,
      oppMistakes: 0,
      oppScore: 0,
      oppPenaltySec: 0,
      oppCorrect: 0,
      totalEmpty: Math.max(1, totalEmpty),
      turn: payload.turn,
      currentTurnUserId: payload.currentTurnUserId,
      turnDeadlineMs: new Date(payload.turnDeadline).getTime(),
      finished: false,
    })
  }

  public startBotSimulationForMatch(matchId: string) {
    const sim = this.simStateMap.get(matchId)
    if (!sim || sim.finished) return
    if (sim.payload.player2.userId !== 'bot-opponent') return

    clearInterval(this.botInterval)

    if (sim.payload.playFormat === PlayFormat.RACE) {
      this.botInterval = window.setInterval(() => {
        const currentSim = this.simStateMap.get(matchId)
        if (!currentSim || currentSim.finished) {
          clearInterval(this.botInterval)
          return
        }
        const startMs = new Date(currentSim.payload.startedAt).getTime()
        if (Date.now() < startMs) return

        currentSim.oppCorrect = Math.min(
          currentSim.totalEmpty,
          currentSim.oppCorrect + 1,
        )
        const progressPercent = Math.round(
          (currentSim.oppCorrect / currentSim.totalEmpty) * 1000,
        ) / 10

        this.opponentProgressListeners.forEach((cb) =>
          cb({
            matchId,
            userId: currentSim.payload.player2.userId,
            filled: currentSim.oppCorrect,
            mistakes: currentSim.oppMistakes,
            lives: currentSim.oppLives,
            penaltySec: currentSim.oppPenaltySec,
            progressPercent,
          }),
        )

        if (currentSim.oppCorrect >= currentSim.totalEmpty) {
          this.finishSimulatedMatch(matchId, currentSim.payload.player2.userId, 'completed')
        }
      }, 4500)
    } else {
      // Duel turn watcher for bot & turn timeout
      this.botInterval = window.setInterval(() => {
        const currentSim = this.simStateMap.get(matchId)
        if (!currentSim || currentSim.finished) {
          clearInterval(this.botInterval)
          return
        }
        const now = Date.now()
        const startMs = new Date(currentSim.payload.startedAt).getTime()
        if (now < startMs) return

        if (now >= currentSim.turnDeadlineMs) {
          // Turn timeout: active player loses 1 life and turn passes
          const timedOutUser = currentSim.currentTurnUserId
          const isPlayer1 = timedOutUser === currentSim.payload.player1.userId
          if (isPlayer1) {
            currentSim.myLives = Math.max(0, currentSim.myLives - 1)
            currentSim.myMistakes += 1
          } else {
            currentSim.oppLives = Math.max(0, currentSim.oppLives - 1)
            currentSim.oppMistakes += 1
          }

          if (currentSim.myLives <= 0) {
            this.finishSimulatedMatch(matchId, currentSim.payload.player2.userId, 'opponent_out_of_lives')
            return
          }
          if (currentSim.oppLives <= 0) {
            this.finishSimulatedMatch(matchId, currentSim.payload.player1.userId, 'opponent_out_of_lives')
            return
          }

          currentSim.currentTurnUserId = isPlayer1
            ? currentSim.payload.player2.userId
            : currentSim.payload.player1.userId
          currentSim.turn += 1
          currentSim.turnDeadlineMs = Date.now() + currentSim.payload.rules.turnSeconds * 1000

          this.turnChangedListeners.forEach((cb) =>
            cb({
              matchId,
              userId: currentSim.currentTurnUserId,
              turn: currentSim.turn,
              deadline: new Date(currentSim.turnDeadlineMs).toISOString(),
            }),
          )

          if (currentSim.currentTurnUserId === 'bot-opponent') {
            this.scheduleBotDuelMove(matchId)
          }
        }
      }, 500)
    }
  }

  private scheduleBotDuelMove(matchId: string) {
    clearTimeout(this.turnTimer)
    this.turnTimer = window.setTimeout(() => {
      const sim = this.simStateMap.get(matchId)
      if (!sim || sim.finished || sim.currentTurnUserId !== 'bot-opponent') return

      const shared = this.simSharedBoardMap.get(matchId) || sim.payload.initial
      const solution = this.simSolutionMap.get(matchId)
      if (!solution) return

      const emptyIndices: number[] = []
      for (let i = 0; i < 81; i++) {
        if (shared[i] === '0' || shared[i] === '.') emptyIndices.push(i)
      }
      if (emptyIndices.length === 0) return

      const chosenIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)]
      const correctDigit = Number(solution[chosenIndex])
      const isBotCorrect = Math.random() < 0.85

      if (isBotCorrect) {
        const nextBoard =
          shared.slice(0, chosenIndex) + String(correctDigit) + shared.slice(chosenIndex + 1)
        this.simSharedBoardMap.set(matchId, nextBoard)
        const points = this.evaluateDuelPoints(shared, chosenIndex, sim.payload.regionMap)
        sim.oppScore += points
        sim.oppCorrect += 1

        this.moveResultListeners.forEach((cb) =>
          cb({
            matchId,
            userId: 'bot-opponent',
            i: chosenIndex,
            v: correctDigit,
            ok: true,
            points,
            score: sim.oppScore,
            lives: sim.oppLives,
            mistakes: sim.oppMistakes,
          }),
        )

        if (!nextBoard.includes('0') && !nextBoard.includes('.')) {
          const winnerId =
            sim.myScore >= sim.oppScore
              ? sim.payload.player1.userId
              : sim.payload.player2.userId
          this.finishSimulatedMatch(matchId, winnerId, 'board_completed')
          return
        }
      } else {
        const wrongDigit = (correctDigit % 9) + 1
        sim.oppLives = Math.max(0, sim.oppLives - 1)
        sim.oppMistakes += 1
        sim.oppScore = Math.max(0, sim.oppScore - 5)

        const revealedMap = this.simRevealedWrongMap.get(matchId) || {}
        const cellList = revealedMap[chosenIndex] ? [...revealedMap[chosenIndex]] : []
        if (!cellList.includes(wrongDigit)) cellList.push(wrongDigit)
        revealedMap[chosenIndex] = cellList
        this.simRevealedWrongMap.set(matchId, revealedMap)

        this.moveResultListeners.forEach((cb) =>
          cb({
            matchId,
            userId: 'bot-opponent',
            i: chosenIndex,
            v: wrongDigit,
            ok: false,
            points: -5,
            score: sim.oppScore,
            lives: sim.oppLives,
            mistakes: sim.oppMistakes,
            revealedWrongDigits: cellList,
          }),
        )

        if (sim.oppLives <= 0) {
          this.finishSimulatedMatch(matchId, sim.payload.player1.userId, 'opponent_out_of_lives')
          return
        }
      }

      sim.currentTurnUserId = sim.payload.player1.userId
      sim.turn += 1
      sim.turnDeadlineMs = Date.now() + sim.payload.rules.turnSeconds * 1000

      this.turnChangedListeners.forEach((cb) =>
        cb({
          matchId,
          userId: sim.currentTurnUserId,
          turn: sim.turn,
          deadline: new Date(sim.turnDeadlineMs).toISOString(),
        }),
      )
    }, 2400)
  }

  private evaluateDuelPoints(boardStr: string, index: number, regionMap: string): number {
    const peers = getPeers(index, regionMap)
    const used = new Set<number>()
    for (const p of peers) {
      const ch = boardStr[p]
      if (ch >= '1' && ch <= '9') used.add(Number(ch))
    }
    const candidates = Math.max(1, 9 - used.size)
    if (candidates === 1) return 5 // Naked Single
    if (candidates === 2) return 10 // Hidden Single
    return 8 * candidates // Advanced (8 * candidates)
  }

  public async submitMove(params: {
    matchId: string
    cellIndex: number
    value: number
    turnNumber: number
  }): Promise<void> {
    const sim = this.simStateMap.get(params.matchId)
    if (!sim && this.isServerOnline && this.connection) {
      await this.connection.invoke('SubmitMove', {
        matchId: params.matchId,
        i: params.cellIndex,
        v: params.value,
        turn: params.turnNumber,
      })
      return
    }

    if (!sim || sim.finished) return
    const callerId = sim.payload.player1.userId
    const solution = this.simSolutionMap.get(params.matchId)
    const expected = solution ? Number(solution[params.cellIndex]) : params.value
    const isCorrect = expected === params.value

    if (sim.payload.playFormat === PlayFormat.DUEL) {
      if (sim.currentTurnUserId !== callerId) return
      const shared = this.simSharedBoardMap.get(params.matchId) || sim.payload.initial

      if (isCorrect) {
        const points = this.evaluateDuelPoints(shared, params.cellIndex, sim.payload.regionMap)
        const nextBoard =
          shared.slice(0, params.cellIndex) +
          String(params.value) +
          shared.slice(params.cellIndex + 1)
        this.simSharedBoardMap.set(params.matchId, nextBoard)
        sim.myScore += points
        sim.myCorrect += 1

        const moveOutcome: MoveResultPayload = {
          matchId: params.matchId,
          userId: callerId,
          i: params.cellIndex,
          v: params.value,
          ok: true,
          points,
          score: sim.myScore,
          lives: sim.myLives,
          mistakes: sim.myMistakes,
        }
        this.moveResultListeners.forEach((cb) => cb(moveOutcome))
        this.channel?.postMessage({
          type: 'CROSS_TAB_MOVE',
          matchId: params.matchId,
          outcome: moveOutcome,
        })

        if (!nextBoard.includes('0') && !nextBoard.includes('.')) {
          const winnerId =
            sim.myScore >= sim.oppScore
              ? sim.payload.player1.userId
              : sim.payload.player2.userId
          this.finishSimulatedMatch(params.matchId, winnerId, 'board_completed')
          return
        }
      } else {
        sim.myLives = Math.max(0, sim.myLives - 1)
        sim.myMistakes += 1
        sim.myScore = Math.max(0, sim.myScore - 5)

        const revealedMap = this.simRevealedWrongMap.get(params.matchId) || {}
        const cellList = revealedMap[params.cellIndex] ? [...revealedMap[params.cellIndex]] : []
        if (!cellList.includes(params.value)) cellList.push(params.value)
        revealedMap[params.cellIndex] = cellList
        this.simRevealedWrongMap.set(params.matchId, revealedMap)

        const moveOutcome: MoveResultPayload = {
          matchId: params.matchId,
          userId: callerId,
          i: params.cellIndex,
          v: params.value,
          ok: false,
          points: -5,
          score: sim.myScore,
          lives: sim.myLives,
          mistakes: sim.myMistakes,
          revealedWrongDigits: cellList,
        }
        this.moveResultListeners.forEach((cb) => cb(moveOutcome))
        this.channel?.postMessage({
          type: 'CROSS_TAB_MOVE',
          matchId: params.matchId,
          outcome: moveOutcome,
        })

        if (sim.myLives <= 0) {
          this.finishSimulatedMatch(
            params.matchId,
            sim.payload.player2.userId,
            'opponent_out_of_lives',
          )
          return
        }
      }

      sim.currentTurnUserId = sim.payload.player2.userId
      sim.turn += 1
      sim.turnDeadlineMs = Date.now() + sim.payload.rules.turnSeconds * 1000

      this.turnChangedListeners.forEach((cb) =>
        cb({
          matchId: params.matchId,
          userId: sim.currentTurnUserId,
          turn: sim.turn,
          deadline: new Date(sim.turnDeadlineMs).toISOString(),
        }),
      )

      if (sim.currentTurnUserId === 'bot-opponent') {
        this.scheduleBotDuelMove(params.matchId)
      }
    } else {
      // Race mode
      const myBoard = this.simPlayerBoardMap.get(params.matchId) || sim.payload.initial
      if (isCorrect) {
        const nextBoard =
          myBoard.slice(0, params.cellIndex) +
          String(params.value) +
          myBoard.slice(params.cellIndex + 1)
        this.simPlayerBoardMap.set(params.matchId, nextBoard)
        sim.myCorrect += 1
        sim.myScore += 10
        const progressPercent =
          Math.round((sim.myCorrect / sim.totalEmpty) * 1000) / 10

        const moveOutcome: MoveResultPayload = {
          matchId: params.matchId,
          userId: callerId,
          i: params.cellIndex,
          v: params.value,
          ok: true,
          points: 10,
          score: sim.myScore,
          lives: sim.myLives,
          mistakes: sim.myMistakes,
          penaltySec: sim.myPenaltySec,
          progressPercent,
        }
        this.moveResultListeners.forEach((cb) => cb(moveOutcome))
        this.channel?.postMessage({
          type: 'CROSS_TAB_MOVE',
          matchId: params.matchId,
          outcome: moveOutcome,
        })

        if (!nextBoard.includes('0') && !nextBoard.includes('.')) {
          this.finishSimulatedMatch(params.matchId, callerId, 'completed')
        }
      } else {
        const wrongSet = this.simWrongMovesMap.get(params.matchId) || new Set<string>()
        const key = `${params.cellIndex}:${params.value}`
        const isDuplicateWrong = wrongSet.has(key)
        if (!isDuplicateWrong) {
          wrongSet.add(key)
          this.simWrongMovesMap.set(params.matchId, wrongSet)
          sim.myLives = Math.max(0, sim.myLives - 1)
          sim.myMistakes += 1
          sim.myPenaltySec += sim.payload.rules.wrongTimePenaltySeconds
        }
        const progressPercent =
          Math.round((sim.myCorrect / sim.totalEmpty) * 1000) / 10

        const moveOutcome: MoveResultPayload = {
          matchId: params.matchId,
          userId: callerId,
          i: params.cellIndex,
          v: params.value,
          ok: false,
          isDuplicateWrong,
          points: 0,
          score: sim.myScore,
          lives: sim.myLives,
          mistakes: sim.myMistakes,
          penaltySec: sim.myPenaltySec,
          progressPercent,
        }
        this.moveResultListeners.forEach((cb) => cb(moveOutcome))

        if (sim.myLives <= 0) {
          this.finishSimulatedMatch(
            params.matchId,
            sim.payload.player2.userId,
            'opponent_out_of_lives',
          )
        }
      }
    }
  }

  private handleCrossTabMove(matchId: string, outcome: MoveResultPayload) {
    const sim = this.simStateMap.get(matchId)
    if (!sim || sim.finished) return
    if (sim.payload.playFormat === PlayFormat.DUEL) {
      if (outcome.ok) {
        const shared = this.simSharedBoardMap.get(matchId) || sim.payload.initial
        const nextBoard =
          shared.slice(0, outcome.i) + String(outcome.v) + shared.slice(outcome.i + 1)
        this.simSharedBoardMap.set(matchId, nextBoard)
      }
      this.moveResultListeners.forEach((cb) => cb(outcome))
    } else {
      this.opponentProgressListeners.forEach((cb) =>
        cb({
          matchId,
          userId: outcome.userId,
          filled: Math.round(((outcome.progressPercent ?? 0) * sim.totalEmpty) / 100),
          mistakes: outcome.mistakes,
          lives: outcome.lives,
          penaltySec: outcome.penaltySec ?? 0,
          progressPercent: outcome.progressPercent ?? 0,
        }),
      )
    }
  }

  public async saveNotes(matchId: string, notes: Record<number, number>): Promise<void> {
    if (!this.simStateMap.has(matchId) && this.isServerOnline && this.connection) {
      try {
        await this.connection.invoke('SaveNotes', { matchId, notes })
      } catch {
        // ignore
      }
    }
  }

  public async resign(matchId: string): Promise<void> {
    const sim = this.simStateMap.get(matchId)
    if (!sim && this.isServerOnline && this.connection) {
      await this.connection.invoke('Resign', { matchId })
      return
    }
    if (sim && !sim.finished) {
      const callerId = this.getCallerIdentity().userId
      const winnerId =
        sim.payload.player1.userId === callerId
          ? sim.payload.player2.userId
          : sim.payload.player1.userId
      this.finishSimulatedMatch(matchId, winnerId, 'resigned')
    }
  }

  private finishSimulatedMatch(matchId: string, winnerUserId: string, reason: string) {
    const sim = this.simStateMap.get(matchId)
    if (!sim || sim.finished) return
    sim.finished = true
    this.clearTimers()

    const p1Won = winnerUserId === sim.payload.player1.userId
    const p1Delta = p1Won ? 20 : -16
    const p2Delta = p1Won ? -16 : 20
    const durationMs = Math.max(
      1000,
      Date.now() - new Date(sim.payload.startedAt).getTime(),
    )

    const summary: MatchEndedPayload = {
      matchId,
      playFormat: sim.payload.playFormat,
      boardLayout: sim.payload.boardLayout,
      levelId: sim.payload.levelId,
      isDraw: false,
      winnerUserId,
      reason,
      durationMs,
      player1: {
        result: p1Won ? MatchResult.WIN : MatchResult.LOSS,
        ratingBefore: sim.payload.player1.rating,
        eloDelta: p1Delta,
        newRating: sim.payload.player1.rating + p1Delta,
        score: sim.myScore,
        lives: sim.myLives,
        mistakes: sim.myMistakes,
      },
      player2: {
        result: p1Won ? MatchResult.LOSS : MatchResult.WIN,
        ratingBefore: sim.payload.player2.rating,
        eloDelta: p2Delta,
        newRating: sim.payload.player2.rating + p2Delta,
        score: sim.oppScore,
        lives: sim.oppLives,
        mistakes: sim.oppMistakes,
      },
    }

    updateLocalEloRating(
      sim.payload.playFormat as PlayFormat,
      summary.player1.newRating,
      p1Won,
    )

    this.saveMatchResult(summary)
    this.channel?.postMessage({ type: 'CROSS_TAB_MATCH_ENDED', payload: summary })
    this.emitMatchEnded(summary)
  }

  public clearTimers() {
    clearTimeout(this.queueTimer)
    this.queueTimer = undefined
    clearInterval(this.botInterval)
    this.botInterval = undefined
    clearTimeout(this.turnTimer)
    this.turnTimer = undefined
  }

  private getStoredCustomRooms(): Record<string, StoredCustomRoom> {
    try {
      const raw = localStorage.getItem(CUSTOM_ROOMS_STORAGE_KEY)
      return raw ? (JSON.parse(raw) as Record<string, StoredCustomRoom>) : {}
    } catch {
      return {}
    }
  }

  public saveActiveMatch(payload: MatchStartedPayload) {
    sessionStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, JSON.stringify(payload))
  }

  public getActiveMatch(matchId?: string): MatchStartedPayload | null {
    try {
      const raw = sessionStorage.getItem(ACTIVE_MATCH_STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as MatchStartedPayload
      if (matchId && parsed.matchId !== matchId) return null
      return parsed
    } catch {
      return null
    }
  }

  public saveMatchResult(payload: MatchEndedPayload) {
    sessionStorage.setItem(LAST_RESULT_STORAGE_KEY, JSON.stringify(payload))
  }

  public getMatchResult(matchId?: string): MatchEndedPayload | null {
    try {
      const raw = sessionStorage.getItem(LAST_RESULT_STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as MatchEndedPayload
      if (matchId && parsed.matchId !== matchId) return null
      return parsed
    } catch {
      return null
    }
  }

  private emitMatchFound(payload: MatchStartedPayload) {
    this.matchFoundListeners.forEach((cb) => cb(payload))
  }

  private emitMatchEnded(payload: MatchEndedPayload) {
    this.matchEndedListeners.forEach((cb) => cb(payload))
  }

  public onMatchFound(cb: Listener<MatchStartedPayload>): () => void {
    this.matchFoundListeners.add(cb)
    return () => this.matchFoundListeners.delete(cb)
  }

  public onCustomRoomCreated(cb: Listener<CustomRoomCreatedPayload>): () => void {
    this.customRoomCreatedListeners.add(cb)
    return () => this.customRoomCreatedListeners.delete(cb)
  }

  public onMoveResult(cb: Listener<MoveResultPayload>): () => void {
    this.moveResultListeners.add(cb)
    return () => this.moveResultListeners.delete(cb)
  }

  public onOpponentProgress(cb: Listener<OpponentProgressPayload>): () => void {
    this.opponentProgressListeners.add(cb)
    return () => this.opponentProgressListeners.delete(cb)
  }

  public onTurnChanged(cb: Listener<TurnChangedPayload>): () => void {
    this.turnChangedListeners.add(cb)
    return () => this.turnChangedListeners.delete(cb)
  }

  public onMatchEnded(cb: Listener<MatchEndedPayload>): () => void {
    this.matchEndedListeners.add(cb)
    return () => this.matchEndedListeners.delete(cb)
  }

  public onRoomStateSynced(cb: Listener<RoomStateSyncedPayload>): () => void {
    this.roomStateSyncedListeners.add(cb)
    return () => this.roomStateSyncedListeners.delete(cb)
  }

  public onOpponentDisconnected(
    cb: Listener<{ matchId: string; userId: string; graceSeconds: number; deadline: string }>,
  ): () => void {
    this.opponentDisconnectedListeners.add(cb)
    return () => this.opponentDisconnectedListeners.delete(cb)
  }

  public onOpponentReconnected(
    cb: Listener<{ matchId: string; userId: string }>,
  ): () => void {
    this.opponentReconnectedListeners.add(cb)
    return () => this.opponentReconnectedListeners.delete(cb)
  }

  public onPlayerReadyChanged(cb: Listener<PlayerReadyChangedPayload>): () => void {
    this.playerReadyListeners.add(cb)
    return () => this.playerReadyListeners.delete(cb)
  }

  public onPreparationEnded(cb: Listener<PreparationEndedPayload>): () => void {
    this.preparationEndedListeners.add(cb)
    return () => this.preparationEndedListeners.delete(cb)
  }

  public async setPlayerReady(matchId: string): Promise<void> {
    const sim = this.simStateMap.get(matchId)
    if (sim) {
      sim.payload.player1Ready = true
      this.playerReadyListeners.forEach((cb) =>
        cb({
          matchId,
          userId: sim.payload.player1.userId,
          player1Ready: true,
          player2Ready: Boolean(sim.payload.player2Ready),
        }),
      )
      // Bot đối thủ tự động sẵn sàng sau 1.2s
      setTimeout(() => {
        if (!sim || sim.finished) return
        sim.payload.player2Ready = true
        sim.payload.isPreparationPhase = false
        this.playerReadyListeners.forEach((cb) =>
          cb({
            matchId,
            userId: sim.payload.player2.userId,
            player1Ready: true,
            player2Ready: true,
          }),
        )
        const startedAt = new Date().toISOString()
        const turnDeadline = new Date(Date.now() + 15000).toISOString()
        this.preparationEndedListeners.forEach((cb) =>
          cb({
            matchId,
            startedAt,
            currentTurnUserId: sim.currentTurnUserId,
            turn: sim.turn,
            turnDeadline,
          }),
        )
      }, 1200)
      return
    }

    const online = await this.ensureConnected()
    if (online && this.connection) {
      await this.connection.invoke('SetPlayerReady', { matchId })
    }
  }
}

export const matchHub = new MatchHubClientManager()
