/**
 * useTutorial.ts — Hook quản lý trạng thái tutorial và localStorage.
 *
 * Keys in localStorage:
 *   - 'tutorial:classic:done'   → 'true' khi đã hoàn thành/bỏ qua classic tutorial
 *   - 'tutorial:shuffle:done'   → 'true' khi đã hoàn thành/bỏ qua shuffle tutorial
 *   - 'tutorial:classic:active' → 'true' khi đang chơi tutorial classic
 *   - 'tutorial:shuffle:active' → 'true' khi đang chơi tutorial shuffle
 */

import { useState, useCallback, useEffect } from 'react'
import type { TutorialMode } from './tutorialData'

const LS_KEY = {
  classicDone: 'tutorial:classic:done',
  shuffleDone: 'tutorial:shuffle:done',
} as const

export function isTutorialDone(mode: 'classic' | 'shuffle'): boolean {
  try {
    return localStorage.getItem(mode === 'classic' ? LS_KEY.classicDone : LS_KEY.shuffleDone) === 'true'
  } catch {
    return false
  }
}

export function markTutorialDone(mode: 'classic' | 'shuffle'): void {
  try {
    localStorage.setItem(
      mode === 'classic' ? LS_KEY.classicDone : LS_KEY.shuffleDone,
      'true',
    )
  } catch {
    // ignore storage errors
  }
}

/** Hook dùng trong SoloSetupPage — quyết định có cần hỏi tutorial không */
export function useTutorialPrompt() {
  // Hỏi classic tutorial khi mới vào, hỏi shuffle khi lần đầu chọn shuffle
  const [showClassicPrompt, setShowClassicPrompt] = useState(false)
  const [showShufflePrompt, setShowShufflePrompt] = useState(false)

  // Kiểm tra khi mount — nếu classic chưa xong → hỏi ngay
  useEffect(() => {
    if (!isTutorialDone('classic')) {
      setShowClassicPrompt(true)
    }
  }, [])

  const checkShufflePrompt = useCallback(() => {
    if (!isTutorialDone('shuffle')) {
      setShowShufflePrompt(true)
    }
  }, [])

  const dismissClassicPrompt = useCallback((accepted: boolean) => {
    if (!accepted) markTutorialDone('classic')
    setShowClassicPrompt(false)
  }, [])

  const dismissShufflePrompt = useCallback((accepted: boolean) => {
    if (!accepted) markTutorialDone('shuffle')
    setShowShufflePrompt(false)
  }, [])

  return {
    showClassicPrompt,
    showShufflePrompt,
    checkShufflePrompt,
    dismissClassicPrompt,
    dismissShufflePrompt,
  }
}

/** Hook dùng trong TutorialPage / TutorialOverlay — step-by-step */
export function useTutorialSteps(totalSteps: number) {
  const [step, setStep] = useState(0)
  const [completed, setCompleted] = useState(false)

  const goNext = useCallback(() => {
    setStep((s) => {
      if (s + 1 >= totalSteps) {
        setCompleted(true)
        return s
      }
      return s + 1
    })
  }, [totalSteps])

  const goPrev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1))
  }, [])

  const goTo = useCallback((index: number) => {
    setStep(Math.max(0, Math.min(totalSteps - 1, index)))
  }, [totalSteps])

  return { step, completed, goNext, goPrev, goTo }
}

/** Hook dùng cho multiplayer rules modal */
export function useMultiplayerRulesModal() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<TutorialMode>('multiplayer-race')

  const openRules = useCallback((m: TutorialMode) => {
    setMode(m)
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  return { open, mode, openRules, close }
}

