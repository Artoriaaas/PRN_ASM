import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Lesson, LessonProgressStore } from './types'
import { defaultProgressStore } from './progressStore'
import { LESSONS } from './lessons'

export function useLessonProgress(store: LessonProgressStore = defaultProgressStore) {
  const [completedMap, setCompletedMap] = useState<Record<string, { completedAt: string }>>({})
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const data = await store.getAll()
      setCompletedMap(data)
    } finally {
      setLoading(false)
    }
  }, [store])

  useEffect(() => {
    void reload()
  }, [reload])

  const completedCodes = useMemo(() => new Set(Object.keys(completedMap)), [completedMap])

  const isUnlocked = useCallback(
    (lessonCode: string): boolean => {
      const idx = LESSONS.findIndex((l) => l.code === lessonCode)
      if (idx <= 0) return true // Bài đầu tiên luôn mở khóa
      const prevLesson = LESSONS[idx - 1]
      return completedCodes.has(prevLesson.code)
    },
    [completedCodes],
  )

  const complete = useCallback(
    async (lessonCode: string) => {
      await store.markCompleted(lessonCode)
      await reload()
    },
    [store, reload],
  )

  const reset = useCallback(async () => {
    await store.reset()
    await reload()
  }, [store, reload])

  const nextLesson = useMemo<Lesson | null>(() => {
    for (const lesson of LESSONS) {
      if (!completedCodes.has(lesson.code)) {
        return lesson
      }
    }
    return null
  }, [completedCodes])

  const allCompleted = useMemo(() => {
    return LESSONS.length > 0 && LESSONS.every((l) => completedCodes.has(l.code))
  }, [completedCodes])

  return {
    loading,
    completedCodes,
    completedMap,
    isUnlocked,
    complete,
    reset,
    nextLesson,
    allCompleted,
    totalCount: LESSONS.length,
    completedCount: LESSONS.filter((l) => completedCodes.has(l.code)).length,
  }
}

