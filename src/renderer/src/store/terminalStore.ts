import { create } from 'zustand'

export interface TerminalTab {
  id: string
  cwd: string
  title: string
  kind: 'claude' | 'shell'
  shellId: string | null
  isRunning: boolean
  exitCode: number | null
}

interface TerminalState {
  tabs: TerminalTab[]
  activeTabId: string | null
  addTab: (tab: TerminalTab) => void
  removeTab: (id: string) => void
  setActive: (id: string) => void
  updateTab: (id: string, patch: Partial<TerminalTab>) => void
  reset: () => void
}

let counter = 0
export function nextTerminalId(): string {
  counter += 1
  return `term-${Date.now()}-${counter}`
}

export const useTerminalStore = create<TerminalState>((set) => ({
  tabs: [],
  activeTabId: null,
  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id
    })),
  removeTab: (id) =>
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.id === id)
      const tabs = state.tabs.filter((t) => t.id !== id)
      let activeTabId = state.activeTabId
      if (activeTabId === id) {
        const fallback = tabs[idx] ?? tabs[idx - 1] ?? tabs[0]
        activeTabId = fallback ? fallback.id : null
      }
      return { tabs, activeTabId }
    }),
  setActive: (id) => set({ activeTabId: id }),
  updateTab: (id, patch) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t))
    })),
  reset: () => set({ tabs: [], activeTabId: null })
}))
