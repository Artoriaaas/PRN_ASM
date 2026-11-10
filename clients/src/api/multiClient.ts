import { createClient } from '@connectrpc/connect'
import {
  MultiplayerService,
  PlayFormat,
  BoardLayoutType,
  MatchStatus,
  MatchResult,
  type PlayerRatingInfo,
  type RankingEntry,
  type MatchHistoryItem,
  type MatchDetail,
} from '../gen/sudoku/multi/v1/multi_pb'
import { transport } from './transport'

export { PlayFormat, BoardLayoutType, MatchStatus, MatchResult }
export type { PlayerRatingInfo, RankingEntry, MatchHistoryItem, MatchDetail }

export const multiClient = createClient(MultiplayerService, transport)

export type PlayerRatingsSummary = {
  race: number
  duel: number
  racePlayed: number
  duelPlayed: number
  raceWins: number
  duelWins: number
}

const RATINGS_CACHE_KEY = 'cache:multi:ratings'
let memoryRatings: PlayerRatingsSummary | null = null
let inFlightRatings: Promise<PlayerRatingsSummary> | null = null

const DEFAULT_RATINGS: PlayerRatingsSummary = {
  race: 1000,
  duel: 1000,
  racePlayed: 0,
  duelPlayed: 0,
  raceWins: 0,
  duelWins: 0,
}

export function getCachedRatingsSync(): PlayerRatingsSummary {
  if (memoryRatings) {
    return memoryRatings
  }

  const stored = sessionStorage.getItem(RATINGS_CACHE_KEY) || localStorage.getItem(RATINGS_CACHE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as PlayerRatingsSummary
      memoryRatings = parsed
      return parsed
    } catch {
      sessionStorage.removeItem(RATINGS_CACHE_KEY)
    }
  }

  return DEFAULT_RATINGS
}

function saveRatingsCache(summary: PlayerRatingsSummary): PlayerRatingsSummary {
  memoryRatings = summary
  const serialized = JSON.stringify(summary)
  sessionStorage.setItem(RATINGS_CACHE_KEY, serialized)
  localStorage.setItem(RATINGS_CACHE_KEY, serialized)
  return summary
}

export async function fetchPlayerRatings(signal?: AbortSignal): Promise<PlayerRatingsSummary> {
  if (inFlightRatings) {
    return inFlightRatings
  }

  const req = multiClient
    .getPlayerRatings({}, { signal })
    .then((res) => {
      const current = getCachedRatingsSync()
      const next: PlayerRatingsSummary = { ...current }
      for (const r of res.ratings) {
        if (r.playFormat === PlayFormat.RACE) {
          next.race = r.rating || 1000
          next.racePlayed = r.matchesPlayed
          next.raceWins = r.matchesWon
        } else if (r.playFormat === PlayFormat.DUEL) {
          next.duel = r.rating || 1000
          next.duelPlayed = r.matchesPlayed
          next.duelWins = r.matchesWon
        }
      }
      return saveRatingsCache(next)
    })
    .catch(() => getCachedRatingsSync())
    .finally(() => {
      inFlightRatings = null
    })

  inFlightRatings = req
  return req
}

export function updateLocalEloRating(
  playFormat: PlayFormat,
  newRating: number,
  isWin: boolean,
): PlayerRatingsSummary {
  const current = getCachedRatingsSync()
  const next: PlayerRatingsSummary = { ...current }
  if (playFormat === PlayFormat.DUEL) {
    next.duel = newRating
    next.duelPlayed += 1
    if (isWin) next.duelWins += 1
  } else {
    next.race = newRating
    next.racePlayed += 1
    if (isWin) next.raceWins += 1
  }
  return saveRatingsCache(next)
}

export type EloDifficultyInfo = {
  levelId: 'easy' | 'medium' | 'hard' | 'expert'
  label: string
  color: string
  tierRange: string
  rankTitle: string
}

export function resolveLevelFromElo(rating: number): EloDifficultyInfo {
  if (rating >= 1500) {
    return {
      levelId: 'expert',
      label: 'Chuyên gia (Expert)',
      color: 'var(--danger)',
      tierRange: '1500+ Elo',
      rankTitle: 'Cao thủ',
    }
  }
  if (rating >= 1300) {
    return {
      levelId: 'hard',
      label: 'Khó (Hard)',
      color: 'var(--opponent)',
      tierRange: '1300 – 1499 Elo',
      rankTitle: 'Tinh anh',
    }
  }
  if (rating >= 1100) {
    return {
      levelId: 'medium',
      label: 'Trung bình (Medium)',
      color: 'var(--warning)',
      tierRange: '1100 – 1299 Elo',
      rankTitle: 'Kỳ thủ',
    }
  }
  return {
    levelId: 'easy',
    label: 'Dễ (Easy)',
    color: 'var(--success)',
    tierRange: '< 1100 Elo',
    rankTitle: 'Tân binh',
  }
}

export async function fetchMatchDetail(
  matchId: string,
  signal?: AbortSignal,
): Promise<MatchDetail | null> {
  try {
    const res = await multiClient.getMatch({ matchId }, { signal })
    return res.match ?? null
  } catch {
    return null
  }
}

export async function fetchRankings(
  playFormat: PlayFormat,
  limit = 50,
  signal?: AbortSignal,
): Promise<{ rankings: RankingEntry[]; callerEntry?: RankingEntry }> {
  try {
    const res = await multiClient.getRankings({ playFormat, limit }, { signal })
    return { rankings: res.rankings, callerEntry: res.callerEntry }
  } catch {
    return { rankings: [] }
  }
}

export async function fetchMatchHistory(
  playFormat: PlayFormat = PlayFormat.UNSPECIFIED,
  limit = 20,
  signal?: AbortSignal,
): Promise<MatchHistoryItem[]> {
  try {
    const res = await multiClient.getMatchHistory({ playFormat, limit }, { signal })
    return res.matches
  } catch {
    return []
  }
}
