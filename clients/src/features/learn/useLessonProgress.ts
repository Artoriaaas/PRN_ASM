import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Lesson, LessonProgressStore } from './types'
import { defaultProgressStore } from './progressStore'
import { LESSONS } from './lessons'
import { createAndPublishNotification } from '../notifications/services/notificationService'
import { loadMockNotifications } from '../notifications/services/mockData'
import type { AppNotification } from '../notifications/services/types'

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

  // Tự động đồng bộ bài học đã hoàn thành trước đó nếu chưa phát thông báo
  useEffect(() => {
    const syncExistingCompletedLessons = async () => {
      try {
        const data = await store.getAll()
        const existingNotifs = loadMockNotifications()

        for (const [code, info] of Object.entries(data)) {
          const lesson = LESSONS.find((l) => l.code === code)
          if (!lesson) continue

          const hasNotif = existingNotifs.some(
            (n) => n.payload.type === 'LESSON_COMPLETED' && n.payload.lessonCode === code,
          )

          if (!hasNotif) {
            const idx = LESSONS.findIndex((l) => l.code === code)
            const next = LESSONS[idx + 1]
            const lessonNotif: AppNotification = {
              id: `notif-lesson-${code}-${new Date(info.completedAt).getTime() || Date.now()}`,
              type: 'LESSON_COMPLETED',
              title: `Bạn đã hoàn thành bài ${lesson.order}/${LESSONS.length}: ${lesson.title}`,
              body:
                lesson.summary ||
                'Kỹ thuật này sẽ là hành trang quan trọng để bạn giải các ván Sudoku một cách tự tin.',
              createdAt: info.completedAt || new Date().toISOString(),
              isRead: false,
              payload: {
                type: 'LESSON_COMPLETED',
                lessonCode: code,
                order: lesson.order,
                total: LESSONS.length,
                nextLessonCode: next?.code,
              },
            }
            createAndPublishNotification(lessonNotif)
          }
        }
      } catch {
        // Bỏ qua lỗi đồng bộ tiến trình
      }
    }

    void syncExistingCompletedLessons()
  }, [store])

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

      const lesson = LESSONS.find((l) => l.code === lessonCode)
      if (lesson) {
        const idx = LESSONS.findIndex((l) => l.code === lessonCode)
        const next = LESSONS[idx + 1]
        const totalLessons = LESSONS.length

        // Phát thông báo hoàn thành bài học
        const lessonNotif: AppNotification = {
          id: `notif-lesson-${lessonCode}-${Date.now()}`,
          type: 'LESSON_COMPLETED',
          title: `Bạn đã hoàn thành bài ${lesson.order}/${totalLessons}: ${lesson.title}`,
          body:
            lesson.summary ||
            'Kỹ thuật này sẽ là hành trang quan trọng để bạn giải các ván Sudoku một cách tự tin.',
          createdAt: new Date().toISOString(),
          isRead: false,
          payload: {
            type: 'LESSON_COMPLETED',
            lessonCode,
            order: lesson.order,
            total: totalLessons,
            nextLessonCode: next?.code,
          },
        }
        createAndPublishNotification(lessonNotif)

        // Kiểm tra nếu đã hoàn thành toàn bộ khóa học
        const all = await store.getAll()
        if (totalLessons > 0 && LESSONS.every((l) => Boolean(all[l.code]))) {
          const courseNotif: AppNotification = {
            id: `notif-course-${Date.now()}`,
            type: 'COURSE_COMPLETED',
            title: 'Chúc mừng! Bạn đã hoàn thành toàn bộ khóa học',
            body: 'Bạn đã thành thạo tất cả các kỹ thuật giải Sudoku. Hãy thử sức ngay trong chế độ Chơi đơn!',
            createdAt: new Date().toISOString(),
            isRead: false,
            payload: {
              type: 'COURSE_COMPLETED',
            },
          }
          createAndPublishNotification(courseNotif)
        }
      }
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
