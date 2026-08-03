import { create } from 'zustand'
import type { TranscriptState, TranscriptSessionSummary } from '@shared/types'
import { useExplorerStore } from './explorerStore'

interface ActivityState {
  transcript: TranscriptState | null
  sessions: TranscriptSessionSummary[]
  watchedRoot: string | null
  start: (rootPath: string) => Promise<void>
  stop: () => Promise<void>
  loadSessions: (rootPath: string) => Promise<void>
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  transcript: null,
  sessions: [],
  watchedRoot: null,

  start: async (rootPath) => {
    if (get().watchedRoot === rootPath) return
    if (get().watchedRoot) await window.api.transcript.unwatch()
    set({ watchedRoot: rootPath, transcript: null })
    await window.api.transcript.watch(rootPath)
  },

  stop: async () => {
    if (!get().watchedRoot) return
    await window.api.transcript.unwatch()
    set({ watchedRoot: null, transcript: null })
  },

  loadSessions: async (rootPath) => {
    const sessions = await window.api.transcript.listSessions(rootPath)
    set({ sessions })
  }
}))

let subscribed = false
/** One IPC listener for the whole app regardless of how many components read the store. */
export function ensureTranscriptSubscription(): void {
  if (subscribed) return
  subscribed = true
  window.api.transcript.onUpdate((state) => {
    useActivityStore.setState({ transcript: state })
    useExplorerStore.getState().setTouchedFiles(new Set(state.touchedFiles))
  })
}
