import {
  LayoutType,
  SessionStatus,
  type SessionState,
} from '../gen/sudoku/game/v1/game_pb'
import { STANDARD_REGION_MAP } from './board'

export const IRREGULAR_REGION_MAP =
  '000001111000022111222222211333344455333444455334466555776666558777666888777788888'

type SeedPuzzle = {
  initial: string
  solution: string
  tier: 'easy' | 'medium' | 'hard' | 'expert'
}

const SEED_PUZZLES: SeedPuzzle[] = [
  {
    tier: 'easy',
    initial:
      '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
    solution:
      '534678912672195348198342567859761423426853791713924856961537284287419635345286179',
  },
  {
    tier: 'medium',
    initial:
      '000260701680070090190004500820100040004602900050003028009300074040050036703018000',
    solution:
      '435269781682571493197834562826195347374682915951743628519326874248957136763418259',
  },
  {
    tier: 'hard',
    initial:
      '000600400700003600000091080000000000050180003000306045040200060903000000020000100',
    solution:
      '581672439792843651364591287438957126256184973179326845845219360913768542627435198',
  },
  {
    tier: 'expert',
    initial:
      '000000012000000003002300400001800005060070800000009000008500000900040500470006000',
    solution:
      '693485712147920003852317496731862945269574831584139267318590000926741580475206100',
  },
]

const IRREGULAR_SEEDS: SeedPuzzle[] = [
  {
    tier: 'easy',
    initial:
      '700050386000049750680207149000060298560000900003706010009580600008000460230601805',
    solution:
      '741952386326849751685237149417365298562418937893726514179584623958173462234691875',
  },
  {
    tier: 'medium',
    initial:
      '000052300306009050080007000410300008500000937890006000079000623050170062230000870',
    solution:
      '741952386326849751685237149417365298562418937893726514179584623958173462234691875',
  },
  {
    tier: 'hard',
    initial:
      '700900006020009000680000049007060208002400000000000014100500620908073002030000870',
    solution:
      '741952386326849751685237149417365298562418937893726514179584623958173462234691875',
  },
  {
    tier: 'expert',
    initial:
      '000002380006840000600007100017000000060410030800000000079000620008000402200090800',
    solution:
      '741952386326849751685237149417365298562418937893726514179584623958173462234691875',
  },
]

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}

function permuteSudoku(seed: SeedPuzzle): { initial: string; solution: string } {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const perm = shuffleArray(digits)
  const mapDigit = (char: string) => {
    if (char === '0' || char === '.') return '0'
    const num = Number(char)
    return String(perm[num - 1])
  }

  const initial = seed.initial.split('').map(mapDigit).join('')
  const solution = seed.solution.split('').map(mapDigit).join('')
  return { initial, solution }
}

const offlineSolutionCache = new Map<string, string>()

export function createOfflineSession(
  levelId: string,
  layoutType: LayoutType = LayoutType.STANDARD,
): SessionState {
  const isIrregular = layoutType === LayoutType.IRREGULAR
  const pool = isIrregular ? IRREGULAR_SEEDS : SEED_PUZZLES
  const matched = pool.find((p) => p.tier === levelId) ?? pool[0]
  const { initial, solution } = permuteSudoku(matched)
  const sessionId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const regionMap = isIrregular ? IRREGULAR_REGION_MAP : STANDARD_REGION_MAP

  offlineSolutionCache.set(sessionId, solution)

  return {
    $typeName: 'sudoku.game.v1.SessionState',
    sessionId,
    levelId,
    layoutType,
    status: SessionStatus.IN_PROGRESS,
    initialBoard: initial,
    currentBoard: initial,
    regionMap,
    notes: [],
    mistakesCount: 0,
    maxMistakes: 3,
    hintsUsed: 0,
    maxHints: 3,
    score: 0,
    elapsedMs: 0n,
    accuracy: 100,
  }
}

export function getOfflineSolution(sessionId: string): string | undefined {
  return offlineSolutionCache.get(sessionId)
}

export function evaluateOfflineMove(
  session: SessionState,
  row: number,
  col: number,
  value: number,
): { isCorrect: boolean; pointsDelta: number } {
  const solution = offlineSolutionCache.get(session.sessionId)
  const index = row * 9 + col
  if (!solution || index < 0 || index >= 81) {
    return { isCorrect: true, pointsDelta: 100 }
  }

  const expected = Number(solution[index])
  const isCorrect = expected === value
  return {
    isCorrect,
    pointsDelta: isCorrect ? 100 : 0,
  }
}
