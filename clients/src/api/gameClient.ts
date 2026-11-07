import { createClient } from '@connectrpc/connect'
import {
  GameService,
  LayoutType,
  SessionStatus,
  type LevelInfo,
  type SessionState,
  type MakeMoveResponse,
  type UseHintResponse,
} from '../gen/sudoku/game/v1/game_pb'
import { transport } from './transport'

export const gameClient = createClient(GameService, transport)

const DEFAULT_LEVELS: LevelInfo[] = [
  {
    $typeName: 'sudoku.game.v1.LevelInfo',
    levelId: 'easy',
    name: 'Dễ',
    sortOrder: 1,
    minClues: 38,
    maxClues: 42,
    maxMistakes: 3,
    maxHints: 3,
  },
  {
    $typeName: 'sudoku.game.v1.LevelInfo',
    levelId: 'medium',
    name: 'Trung bình',
    sortOrder: 2,
    minClues: 32,
    maxClues: 36,
    maxMistakes: 3,
    maxHints: 3,
  },
  {
    $typeName: 'sudoku.game.v1.LevelInfo',
    levelId: 'hard',
    name: 'Khó',
    sortOrder: 3,
    minClues: 28,
    maxClues: 31,
    maxMistakes: 3,
    maxHints: 3,
  },
  {
    $typeName: 'sudoku.game.v1.LevelInfo',
    levelId: 'expert',
    name: 'Chuyên gia',
    sortOrder: 4,
    minClues: 24,
    maxClues: 27,
    maxMistakes: 3,
    maxHints: 3,
  },
]

let cachedLevels: LevelInfo[] | null = null

export async function fetchLevels(signal?: AbortSignal): Promise<LevelInfo[]> {
  if (cachedLevels && cachedLevels.length > 0) {
    return cachedLevels
  }

  const stored = sessionStorage.getItem('cache:game:levels')
  if (stored) {
    try {
      cachedLevels = JSON.parse(stored) as LevelInfo[]
      return cachedLevels
    } catch {
      sessionStorage.removeItem('cache:game:levels')
    }
  }

  try {
    const res = await gameClient.listLevels({}, { signal })
    if (res.levels && res.levels.length > 0) {
      cachedLevels = res.levels
      sessionStorage.setItem('cache:game:levels', JSON.stringify(res.levels))
      return res.levels
    }
  } catch (err) {
    console.warn('GameService.ListLevels failed, using default levels:', err)
  }

  return DEFAULT_LEVELS
}

export async function startGameSession(
  levelId: string,
  layoutType: LayoutType = LayoutType.STANDARD,
  signal?: AbortSignal,
): Promise<SessionState> {
  const res = await gameClient.startGame(
    {
      levelId,
      layoutType,
    },
    { signal },
  )

  if (!res.session) {
    throw new Error('GameService did not return session state.')
  }

  return res.session
}

export async function getGameSession(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SessionState> {
  const res = await gameClient.getSession({ sessionId }, { signal })
  if (!res.session) {
    throw new Error(`Game session ${sessionId} not found.`)
  }
  return res.session
}

export async function makeGameMove(
  sessionId: string,
  row: number,
  col: number,
  value: number,
  signal?: AbortSignal,
): Promise<MakeMoveResponse> {
  return await gameClient.makeMove(
    {
      sessionId,
      row,
      col,
      value,
    },
    { signal },
  )
}

export async function requestGameHint(
  sessionId: string,
  targetRow?: number,
  targetCol?: number,
  signal?: AbortSignal,
): Promise<UseHintResponse> {
  return await gameClient.useHint(
    {
      sessionId,
      targetRow,
      targetCol,
    },
    { signal },
  )
}

export async function abandonGameSession(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SessionState> {
  const res = await gameClient.abandonGame({ sessionId }, { signal })
  if (!res.session) {
    throw new Error(`Failed to abandon session ${sessionId}`)
  }
  return res.session
}

export { LayoutType, SessionStatus }
