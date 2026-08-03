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
  /** 1-based line to scroll to on open — e.g. from a search result */
  previewLine: number | null
  /** bumped on every setPreview call so PreviewPane re-scrolls even when clicking a different match in the same file */
  previewNonce: number
  gitStatus: GitStatusMap
  dirtyDirs: Set<string>
  isGitRepo: boolean
  gitBranch: string | null
  gitAhead: number
  gitBehind: number
  /** absolute paths the agent has read/edited this session — feeds the tree's "tocado" badge */
  touchedFiles: Set<string>

  setRoot: (root: string) => Promise<void>
  setTouchedFiles: (files: Set<string>) => void
  toggleExpand: (dirPath: string) => void
  loadDir: (dirPath: string, force?: boolean) => Promise<void>
  handleFsEvent: (path: string) => void
  refreshGitStatus: () => Promise<void>
  setSelected: (path: string | null) => void
  setPreview: (path: string | null, line?: number) => void
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
  previewLine: null,
  previewNonce: 0,
  gitStatus: {},
  dirtyDirs: new Set(),
  isGitRepo: false,
  gitBranch: null,
  gitAhead: 0,
  gitBehind: 0,
  touchedFiles: new Set(),

  setRoot: async (root) => {
    const prevRoot = get().rootPath
    if (prevRoot) await window.api.fs.unwatch(prevRoot)
    set({
      rootPath: root,
      children: {},
      expanded: new Set([root]),
      selectedPath: null,
      previewPath: null,
      previewLine: null,
      gitStatus: {},
      dirtyDirs: new Set(),
      isGitRepo: false,
      gitBranch: null,
      gitAhead: 0,
      gitBehind: 0,
      touchedFiles: new Set()
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

  setTouchedFiles: (files) => set({ touchedFiles: files }),
  setSelected: (path) => set({ selectedPath: path }),
  setPreview: (path, line) => set((state) => ({ previewPath: path, previewLine: line ?? null, previewNonce: state.previewNonce + 1 }))
}))
