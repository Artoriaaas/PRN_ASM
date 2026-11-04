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
  sessionStorage.setItem(cacheKey(firebaseUid), JSON.stringify(profile))
  return profile
}

export function getCachedProfile(firebaseUid: string) {
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
    .then((response) => cacheProfile(user.uid, requireProfile(response.profile)))
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
