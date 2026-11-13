import { createClient } from '@connectrpc/connect'
import type { User } from 'firebase/auth'
import {
  UserService,
  type UserProfile,
} from '../gen/sudoku/user/v1/user_pb'
import { transport } from './transport'

const userClient = createClient(UserService, transport)
const memoryCache = new Map<string, UserProfile>()
const inFlight = new Map<string, Promise<UserProfile>>()

function cacheKey(firebaseUid: string) {
  return `profile:${firebaseUid}`
}

function requireProfile(profile: UserProfile | undefined) {
  if (!profile) {
    throw new Error('User Service không trả về hồ sơ.')
  }

  return profile
}

function cacheProfile(firebaseUid: string, profile: UserProfile) {
  memoryCache.set(firebaseUid, profile)
  try {
    sessionStorage.setItem(cacheKey(firebaseUid), JSON.stringify(profile))
  } catch {
    // Ignore storage quota error
  }
  return profile
}

export function getCachedProfile(firebaseUid: string): UserProfile | null {
  const memoryValue = memoryCache.get(firebaseUid)
  if (memoryValue) {
    return memoryValue
  }

  const storedValue = sessionStorage.getItem(cacheKey(firebaseUid))
  if (!storedValue) {
    return null
  }

  try {
    const profile = JSON.parse(storedValue) as UserProfile
    memoryCache.set(firebaseUid, profile)
    return profile
  } catch {
    sessionStorage.removeItem(cacheKey(firebaseUid))
    return null
  }
}

export function syncUserProfile(user: User, signal: AbortSignal) {
  const existingRequest = inFlight.get(user.uid)
  if (existingRequest) {
    return existingRequest
  }

  const request = userClient
    .getOrCreateProfile(
      {
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        avatarUrl: user.photoURL ?? '',
      },
      { signal },
    )
    .then((response) => {
      const serverProfile = requireProfile(response.profile)
      const cached = getCachedProfile(user.uid)

      // Bảo toàn tiến trình nếu local đã tích lũy điểm số/ván đấu (ví dụ khi chơi offline)
      if (cached) {
        if ((cached.totalExp ?? 0) > (serverProfile.totalExp ?? 0)) {
          serverProfile.totalExp = cached.totalExp
          serverProfile.playerLevel = Math.max(serverProfile.playerLevel, cached.playerLevel)
        }
        if ((cached.totalGames ?? 0) > (serverProfile.totalGames ?? 0)) {
          serverProfile.totalGames = cached.totalGames
          serverProfile.wins = Math.max(serverProfile.wins, cached.wins)
        }
      }

      return cacheProfile(user.uid, serverProfile)
    })
    .finally(() => inFlight.delete(user.uid))

  inFlight.set(user.uid, request)
  return request
}

export async function updateUserProfile(
  firebaseUid: string,
  input: { displayName: string; avatarUrl: string; country: string },
) {
  const response = await userClient.updateProfile(input)
  return cacheProfile(firebaseUid, requireProfile(response.profile))
}

export function clearCachedProfile(firebaseUid: string) {
  memoryCache.delete(firebaseUid)
  sessionStorage.removeItem(cacheKey(firebaseUid))
}

/**
 * Ghi nhận kết quả ván đấu cục bộ ngay lập tức (cho cả chế độ online và offline)
 * Tự động tính toán tăng số ván chơi, chiến thắng, kinh nghiệm (XP) và nâng cấp độ người chơi.
 */
export function recordLocalGameResult(
  firebaseUid: string,
  xpGained: number,
  isWin = true,
  fallbackDisplayName = 'Người chơi',
): {
  profile: UserProfile
  leveledUp: boolean
  oldLevel: number
  newLevel: number
} {
  const current = getCachedProfile(firebaseUid)
  const baseProfile: UserProfile = current ?? ({
    id: firebaseUid,
    displayName: fallbackDisplayName,
    email: '',
    avatarUrl: '',
    country: 'VN',
    totalGames: 0,
    wins: 0,
    totalExp: 0,
    playerLevel: 1,
    trophies: 0,
  } as unknown as UserProfile)

  const oldLevel = baseProfile.playerLevel || 1
  const oldExp = baseProfile.totalExp || 0
  const updatedExp = oldExp + xpGained
  // Công thức thăng cấp: Mỗi 500 XP lên 1 cấp (Cấp 1: 0-499, Cấp 2: 500-999...)
  const newLevel = Math.max(1, 1 + Math.floor(updatedExp / 500))
  const leveledUp = newLevel > oldLevel

  const updatedProfile: UserProfile = {
    ...baseProfile,
    totalGames: (baseProfile.totalGames || 0) + 1,
    wins: isWin ? (baseProfile.wins || 0) + 1 : (baseProfile.wins || 0),
    totalExp: updatedExp,
    playerLevel: newLevel,
    trophies: (baseProfile.trophies || 0) + (isWin ? 5 : 0),
  } as unknown as UserProfile

  cacheProfile(firebaseUid, updatedProfile)

  // Bắn sự kiện window để cập nhật Header, HomePage, XpBar ngay lập tức
  window.dispatchEvent(new CustomEvent('sudoku:profile-updated', { detail: updatedProfile }))

  return {
    profile: updatedProfile,
    leveledUp,
    oldLevel,
    newLevel,
  }
}
