import { create } from 'zustand'
import type { FileEntry, GitStatusMap } from '@shared/types'
import { dirname, isDescendantOrSelf } from '@renderer/components/Explorer/pathUtils'

interface ExplorerState {
  rootPath: string | null
  children: Record<string, FileEntry[] | undefined>
  loadingDirs: Set<string>
  expanded: Set<string>
  selectedPath: string | null
  /** file currently shown in the local, zero-token Preview pane */
  previewPath: string | null
  gitStatus: GitStatusMap
  dirtyDirs: Set<string>
  isGitRepo: boolean
  gitBranch: string | null
  gitAhead: number
  gitBehind: number

  setRoot: (root: string) => Promise<void>
  toggleExpand: (dirPath: string) => void
  loadDir: (dirPath: string, force?: boolean) => Promise<void>
  handleFsEvent: (path: string) => void
  refreshGitStatus: () => Promise<void>
  setSelected: (path: string | null) => void
  setPreview: (path: string | null) => void
}

let gitRefreshTimer: ReturnType<typeof setTimeout> | null = null

function computeDirtyDirs(root: string, status: GitStatusMap): Set<string> {
  const dirty = new Set<string>()
  for (const filePath of Object.keys(status)) {
    let dir = dirname(filePath)
    while (dir && isDescendantOrSelf(root, dir)) {
      if (dirty.has(dir)) break
      dirty.add(dir)
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return dirty
}

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  rootPath: null,
  children: {},
  loadingDirs: new Set(),
  expanded: new Set(),
  selectedPath: null,
  previewPath: null,
  gitStatus: {},
  dirtyDirs: new Set(),
  isGitRepo: false,
  gitBranch: null,
  gitAhead: 0,
  gitBehind: 0,

  setRoot: async (root) => {
    const prevRoot = get().rootPath
    if (prevRoot) await window.api.fs.unwatch(prevRoot)
    set({
      rootPath: root,
      children: {},
      expanded: new Set([root]),
      selectedPath: null,
      previewPath: null,
      gitStatus: {},
      dirtyDirs: new Set(),
      isGitRepo: false,
      gitBranch: null,
      gitAhead: 0,
      gitBehind: 0
    })
    await window.api.fs.watch(root)
    await get().loadDir(root)
    await get().refreshGitStatus()
  },

  toggleExpand: (dirPath) => {
    const expanded = new Set(get().expanded)
    if (expanded.has(dirPath)) {
      expanded.delete(dirPath)
      set({ expanded })
    } else {
      expanded.add(dirPath)
      set({ expanded })
      void get().loadDir(dirPath)
    }
  },

  loadDir: async (dirPath, force = false) => {
    if (!force && get().children[dirPath]) return
    if (get().loadingDirs.has(dirPath)) return
    const loadingDirs = new Set(get().loadingDirs)
    loadingDirs.add(dirPath)
    set({ loadingDirs })
    try {
      const entries = await window.api.fs.readDir(dirPath)
      set((state) => ({ children: { ...state.children, [dirPath]: entries } }))
    } catch {
      set((state) => ({ children: { ...state.children, [dirPath]: [] } }))
    } finally {
      const next = new Set(get().loadingDirs)
      next.delete(dirPath)
      set({ loadingDirs: next })
    }
  },

  handleFsEvent: (path) => {
    const dir = dirname(path)
    if (get().children[dir]) {
      void get().loadDir(dir, true)
    }
    if (gitRefreshTimer) clearTimeout(gitRefreshTimer)
    gitRefreshTimer = setTimeout(() => {
      void get().refreshGitStatus()
    }, 300)
  },

  refreshGitStatus: async () => {
    const root = get().rootPath
    if (!root) return
    try {
      const result = await window.api.git.status(root)
      const dirtyDirs = computeDirtyDirs(root, result.files)
      set({
        gitStatus: result.files,
        dirtyDirs,
        isGitRepo: result.isRepo,
        gitBranch: result.branch,
        gitAhead: result.ahead,
        gitBehind: result.behind
      })
    } catch {
      // not a repo or git unavailable — leave status empty
    }
  },

  setSelected: (path) => set({ selectedPath: path }),
  setPreview: (path) => set({ previewPath: path })
}))
