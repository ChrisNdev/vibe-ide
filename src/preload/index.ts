import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  FileEntry,
  GitRepoStatus,
  PtySpawnOptions,
  PtyExitEvent,
  ShellInfo,
  AppSettings,
  RecentProject,
  FsWatchEvent,
  ProjectGraph,
  FileReadResult,
  UpdateCheckResult,
  UpdateInstallResult,
  BackgroundConfig,
  BackgroundImageResult,
  ThemeExportResult,
  ThemeImportResult,
  SearchOptions,
  SearchMatch,
  SearchDoneEvent,
  HookEvent,
  HooksInstallResult,
  HooksStatus
} from '../shared/types'

const api = {
  platform: process.platform,
  dialog: {
    openFolder: (): Promise<string | null> => ipcRenderer.invoke(IPC.DIALOG_OPEN_FOLDER)
  },
  fs: {
    readDir: (dirPath: string): Promise<FileEntry[]> => ipcRenderer.invoke(IPC.FS_READ_DIR, dirPath),
    createFile: (filePath: string): Promise<void> => ipcRenderer.invoke(IPC.FS_CREATE_FILE, filePath),
    createDir: (dirPath: string): Promise<void> => ipcRenderer.invoke(IPC.FS_CREATE_DIR, dirPath),
    rename: (oldPath: string, newPath: string): Promise<void> =>
      ipcRenderer.invoke(IPC.FS_RENAME, oldPath, newPath),
    delete: (targetPath: string): Promise<void> => ipcRenderer.invoke(IPC.FS_DELETE, targetPath),
    duplicate: (sourcePath: string): Promise<string> => ipcRenderer.invoke(IPC.FS_DUPLICATE, sourcePath),
    move: (sourcePath: string, destDir: string): Promise<string> =>
      ipcRenderer.invoke(IPC.FS_MOVE, sourcePath, destDir),
    reveal: (targetPath: string): Promise<void> => ipcRenderer.invoke(IPC.FS_REVEAL, targetPath),
    watch: (rootPath: string): Promise<void> => ipcRenderer.invoke(IPC.FS_WATCH, rootPath),
    unwatch: (rootPath: string): Promise<void> => ipcRenderer.invoke(IPC.FS_UNWATCH, rootPath),
    onEvent: (cb: (evt: FsWatchEvent) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, evt: FsWatchEvent): void => cb(evt)
      ipcRenderer.on(IPC.FS_EVENT, listener)
      return () => ipcRenderer.removeListener(IPC.FS_EVENT, listener)
    },
    readFile: (filePath: string): Promise<FileReadResult> => ipcRenderer.invoke(IPC.FS_READ_FILE, filePath)
  },
  git: {
    status: (rootPath: string): Promise<GitRepoStatus> => ipcRenderer.invoke(IPC.GIT_STATUS, rootPath),
    diff: (rootPath: string, filePath: string): Promise<string> =>
      ipcRenderer.invoke(IPC.GIT_DIFF, rootPath, filePath),
    commit: (rootPath: string, message: string): Promise<void> =>
      ipcRenderer.invoke(IPC.GIT_COMMIT, rootPath, message),
    push: (rootPath: string): Promise<void> => ipcRenderer.invoke(IPC.GIT_PUSH, rootPath)
  },
  pty: {
    spawn: (opts: PtySpawnOptions): Promise<void> => ipcRenderer.invoke(IPC.PTY_SPAWN, opts),
    write: (id: string, data: string): Promise<void> => ipcRenderer.invoke(IPC.PTY_WRITE, id, data),
    resize: (id: string, cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke(IPC.PTY_RESIZE, id, cols, rows),
    kill: (id: string): Promise<void> => ipcRenderer.invoke(IPC.PTY_KILL, id),
    onData: (cb: (id: string, data: string) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, payload: { id: string; data: string }): void =>
        cb(payload.id, payload.data)
      ipcRenderer.on(IPC.PTY_DATA, listener)
      return () => ipcRenderer.removeListener(IPC.PTY_DATA, listener)
    },
    onExit: (cb: (evt: PtyExitEvent) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, evt: PtyExitEvent): void => cb(evt)
      ipcRenderer.on(IPC.PTY_EXIT, listener)
      return () => ipcRenderer.removeListener(IPC.PTY_EXIT, listener)
    }
  },
  shells: {
    detect: (): Promise<ShellInfo[]> => ipcRenderer.invoke(IPC.SHELLS_DETECT)
  },
  claude: {
    detect: (): Promise<string | null> => ipcRenderer.invoke(IPC.CLAUDE_DETECT)
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (partial: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_SET, partial)
  },
  recents: {
    get: (): Promise<RecentProject[]> => ipcRenderer.invoke(IPC.RECENTS_GET),
    add: (path: string): Promise<RecentProject[]> => ipcRenderer.invoke(IPC.RECENTS_ADD, path),
    remove: (path: string): Promise<RecentProject[]> => ipcRenderer.invoke(IPC.RECENTS_REMOVE, path),
    togglePin: (path: string): Promise<RecentProject[]> => ipcRenderer.invoke(IPC.RECENTS_TOGGLE_PIN, path)
  },
  clipboard: {
    writeText: (text: string): Promise<void> => ipcRenderer.invoke(IPC.CLIPBOARD_WRITE, text)
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke(IPC.APP_GET_VERSION),
    getHomeDir: (): Promise<string> => ipcRenderer.invoke(IPC.APP_GET_HOME_DIR),
    checkForUpdate: (): Promise<UpdateCheckResult> => ipcRenderer.invoke(IPC.APP_CHECK_UPDATE),
    installUpdate: (releaseTag: string): Promise<UpdateInstallResult> =>
      ipcRenderer.invoke(IPC.APP_INSTALL_UPDATE, releaseTag),
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.APP_OPEN_EXTERNAL, url)
  },
  graph: {
    build: (rootPath: string): Promise<ProjectGraph> => ipcRenderer.invoke(IPC.GRAPH_BUILD, rootPath)
  },
  background: {
    pickImage: (bg: Pick<BackgroundConfig, 'blur' | 'brightness' | 'saturation'>): Promise<BackgroundImageResult | null> =>
      ipcRenderer.invoke(IPC.BACKGROUND_PICK_IMAGE, bg),
    remove: (): Promise<void> => ipcRenderer.invoke(IPC.BACKGROUND_REMOVE),
    regenerate: (
      id: string,
      bg: Pick<BackgroundConfig, 'blur' | 'brightness' | 'saturation'>
    ): Promise<BackgroundImageResult | null> => ipcRenderer.invoke(IPC.BACKGROUND_REGENERATE, id, bg)
  },
  theme: {
    export: (name: string, tokens: Record<string, string>, background: BackgroundConfig): Promise<ThemeExportResult> =>
      ipcRenderer.invoke(IPC.THEME_EXPORT, name, tokens, background),
    import: (): Promise<ThemeImportResult> => ipcRenderer.invoke(IPC.THEME_IMPORT)
  },
  search: {
    run: (rootPath: string, opts: SearchOptions): Promise<void> => ipcRenderer.invoke(IPC.SEARCH_RUN, rootPath, opts),
    cancel: (): Promise<void> => ipcRenderer.invoke(IPC.SEARCH_CANCEL),
    listFiles: (rootPath: string): Promise<string[]> => ipcRenderer.invoke(IPC.SEARCH_LIST_FILES, rootPath),
    onResult: (cb: (matches: SearchMatch[]) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, matches: SearchMatch[]): void => cb(matches)
      ipcRenderer.on(IPC.SEARCH_RESULT, listener)
      return () => ipcRenderer.removeListener(IPC.SEARCH_RESULT, listener)
    },
    onDone: (cb: (evt: SearchDoneEvent) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, evt: SearchDoneEvent): void => cb(evt)
      ipcRenderer.on(IPC.SEARCH_DONE, listener)
      return () => ipcRenderer.removeListener(IPC.SEARCH_DONE, listener)
    }
  },
  hooks: {
    install: (rootPath: string): Promise<HooksInstallResult> => ipcRenderer.invoke(IPC.HOOKS_INSTALL, rootPath),
    uninstall: (rootPath: string): Promise<HooksInstallResult> => ipcRenderer.invoke(IPC.HOOKS_UNINSTALL, rootPath),
    status: (rootPath: string): Promise<HooksStatus> => ipcRenderer.invoke(IPC.HOOKS_STATUS, rootPath),
    onEvent: (cb: (evt: HookEvent) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, evt: HookEvent): void => cb(evt)
      ipcRenderer.on(IPC.HOOKS_EVENT, listener)
      return () => ipcRenderer.removeListener(IPC.HOOKS_EVENT, listener)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
