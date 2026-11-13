// Hệ thống nhiệm vụ hằng ngày — frontend-only (localStorage)

export type QuestLayout = 'standard' | 'irregular'
export type QuestDifficulty = 'easy' | 'medium' | 'hard'
export type QuestStatus = 'pending' | 'completed'

export interface DailyQuest {
  id: string
  taskCode: string
  title: string
  description: string
  boardLayout: QuestLayout
  difficulty: QuestDifficulty
  xpReward: number
  status: QuestStatus
  completedAt?: string
}

interface StoredQuestData {
  date: string // YYYY-MM-DD
  quests: DailyQuest[]
}

const STORAGE_KEY = 'sudoku_daily_quests_v1'

const LAYOUT_LABELS: Record<QuestLayout, string> = {
  standard: 'Standard',
  irregular: 'Shuffle',
}

const DIFFICULTY_LABELS: Record<QuestDifficulty, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
}

const XP_REWARDS: Record<QuestDifficulty, number> = {
  easy: 50,
  medium: 80,
  hard: 120,
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Pseudo-random number generator seeded by date string — deterministic per day */
function seededRandom(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  let s = h
  return function () {
    s ^= s << 13
    s ^= s >> 17
    s ^= s << 5
    s = s >>> 0
    return s / 4294967296
  }
}

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]
}

export function generateDailyQuests(dateStr: string): DailyQuest[] {
  const rand = seededRandom(dateStr)

  const layouts: QuestLayout[] = ['standard', 'irregular']

  // Quest 1: layout ngẫu nhiên, độ khó dễ hoặc trung bình
  const layout1 = pick(layouts, rand)
  const diff1 = pick(['easy', 'medium'] as QuestDifficulty[], rand)

  // Quest 2: layout khác với quest 1, độ khó trung bình hoặc khó
  const layout2 = layout1 === 'standard' ? 'irregular' : 'standard'
  const diff2 = pick(['medium', 'hard'] as QuestDifficulty[], rand)

  const makeQuest = (
    idx: number,
    layout: QuestLayout,
    difficulty: QuestDifficulty,
  ): DailyQuest => ({
    id: `quest-${dateStr}-${idx}`,
    taskCode: `daily-${dateStr}-${idx}`,
    title: `Giải ${LAYOUT_LABELS[layout]} ${DIFFICULTY_LABELS[difficulty]}`,
    description: `Hoàn thành 1 ván Sudoku ${LAYOUT_LABELS[layout]} ở độ khó ${DIFFICULTY_LABELS[difficulty]}.`,
    boardLayout: layout,
    difficulty,
    xpReward: XP_REWARDS[difficulty],
    status: 'pending',
  })

  return [makeQuest(1, layout1, diff1), makeQuest(2, layout2, diff2)]
}

export function loadTodayQuests(): DailyQuest[] {
  const today = todayStr()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as StoredQuestData
      if (stored.date === today) {
        return stored.quests
      }
    }
  } catch {
    // ignore parse errors
  }
  // Ngày mới hoặc chưa có dữ liệu → tạo mới
  const quests = generateDailyQuests(today)
  saveTodayQuests(quests)
  return quests
}

export function saveTodayQuests(quests: DailyQuest[]): void {
  const today = todayStr()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, quests }))
  } catch {
    // ignore quota errors
  }
}

/** Đánh dấu nhiệm vụ hoàn thành, trả về quest đã cập nhật hoặc null nếu không tìm thấy */
export function markQuestComplete(taskCode: string): DailyQuest | null {
  const quests = loadTodayQuests()
  const idx = quests.findIndex((q) => q.taskCode === taskCode)
  if (idx === -1) return null

  quests[idx] = {
    ...quests[idx],
    status: 'completed',
    completedAt: new Date().toISOString(),
  }
  saveTodayQuests(quests)
  return quests[idx]
}

/**
 * Kiểm tra xem ván vừa hoàn thành có khớp với nhiệm vụ chờ nào không.
 * layout: 'standard' | 'irregular'
 * difficulty: 'easy' | 'medium' | 'hard' | 'expert'
 */
export function checkQuestCompletion(
  layout: string,
  difficulty: string,
): DailyQuest | null {
  const quests = loadTodayQuests()
  const match = quests.find(
    (q) =>
      q.status === 'pending' &&
      q.boardLayout === layout &&
      q.difficulty === difficulty,
  )
  return match ?? null
}

export { DIFFICULTY_LABELS, LAYOUT_LABELS, XP_REWARDS, todayStr }
