export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isSymlink: boolean
}

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'staged' | 'conflicted'

export interface GitStatusMap {
  [relativePath: string]: GitFileStatus
}

export interface GitRepoStatus {
  isRepo: boolean
  branch: string | null
  files: GitStatusMap
  ahead: number
  behind: number
}

export interface PtySpawnOptions {
  id: string
  cwd: string
  shell?: string
  args?: string[]
  cols: number
  rows: number
  /** command to run automatically once the shell is ready (e.g. "claude") */
  autoRun?: string
}

export interface PtyExitEvent {
  id: string
  exitCode: number
  signal?: number
}

export interface ShellInfo {
  id: string
  name: string
  path: string
}

export interface RecentProject {
  path: string
  name: string
  lastOpened: number
  pinned: boolean
}

/**
 * L0 media kind for the background layer (SISTEMA DE DESIGN → Fundo personalizável).
 * 'procedural' covers the shipped presets (proof strip, halftone, registration marks,
 * kraft) — generated as CSS/SVG, not raster files, so there's nothing to download/copy.
 */
export type BackgroundKind = 'none' | 'image' | 'gradient' | 'solid' | 'procedural'

export interface BackgroundConfig {
  kind: BackgroundKind
  /** references a file copied into userData/backgrounds/, set only when kind === 'image' */
  imageId: string | null
  gradientFrom: string
  gradientTo: string
  solidColor: string
  /** 'proof-strip' | 'halftone' | 'registration' | 'kraft', set only when kind === 'procedural' */
  proceduralId: string | null
  /** px, feeds --bg-blur on the pre-blurred L0 image */
  blur: number
  /** 0–2 multiplier */
  brightness: number
  /** 0–2 multiplier */
  saturation: number
  /** 0–1, feeds --veil (L1) */
  veil: number
  /** 0–1, feeds --surface-alpha (L2) */
  surfaceAlpha: number
  /** hex, duotone highlight ink + feeds --spot */
  spot: string
  /** guarda de contraste: locks a floor on --veil so L3 text never drops below 4.5:1 */
  contrastGuaranteed: boolean
  /** off by default — switches the terminal to xterm's Canvas renderer so its panel can show the veil through it */
  terminalTranslucent: boolean
  /** Windows 11 only: BrowserWindow backgroundMaterial 'mica' instead of the L0/L1/L2 stack */
  useSystemWallpaper: boolean
}

export interface BackgroundImageResult {
  id: string
  width: number
  height: number
  fullUrl: string
  blurredUrl: string
}

/** .vibe-theme.json — importable/exportable bundle of the current tokens + background. */
export interface ThemeFile {
  version: 1
  name: string
  tokens: Record<string, string>
  background: Omit<BackgroundConfig, 'imageId'> & {
    imageBase64: string | null
    imageExt: string | null
  }
}

export interface ThemeExportResult {
  ok: boolean
  path?: string
  error?: string
}

export interface ThemeImportResult {
  ok: boolean
  name?: string
  tokens?: Record<string, string>
  background?: BackgroundConfig
  error?: string
}

export interface AppSettings {
  claudeCommand: string
  defaultShellId: string | null
  fontSize: number
  theme: 'dark' | 'light'
  sidebarWidth: number
  sidebarCollapsed: boolean
  background: BackgroundConfig
}

export interface FsWatchEvent {
  type: 'add' | 'addDir' | 'unlink' | 'unlinkDir' | 'change'
  path: string
}

export interface FileReadResult {
  content: string
  size: number
  /** file exceeds the preview size cap and wasn't read */
  truncated: boolean
  /** looks like a binary file (NUL byte found), content is empty */
  binary: boolean
}

export interface GraphNode {
  /** path relative to project root, POSIX separators */
  id: string
  label: string
  dir: string
  ext: string
  size: number
}

export interface GraphEdge {
  source: string
  target: string
}

export interface ProjectGraph {
  root: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** true if the scan hit the file cap and stopped early */
  truncated: boolean
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string | null
  /** raw git tag (e.g. "v1.2.0") — what gh release download expects, unlike latestVersion */
  latestTag: string | null
  hasUpdate: boolean
  releaseUrl: string | null
  /** the gh CLI wasn't found, isn't logged in, or the check failed for another reason */
  error: boolean
}

export interface UpdateInstallResult {
  ok: boolean
  error?: string
}

export interface SearchOptions {
  query: string
  caseSensitive: boolean
  regex: boolean
  respectGitignore: boolean
  /** glob, e.g. "*.ts" — empty means no filter */
  includeGlob: string
  /** glob, e.g. "*.test.ts" — empty means no filter */
  excludeGlob: string
}

export interface SearchMatch {
  /** absolute path */
  file: string
  line: number
  /** 0-based column offsets into lineText */
  matchStart: number
  matchEnd: number
  lineText: string
}

export interface SearchDoneEvent {
  total: number
  truncated: boolean
  cancelled: boolean
}

export const IPC = {
  DIALOG_OPEN_FOLDER: 'dialog:openFolder',
  FS_READ_DIR: 'fs:readDir',
  FS_CREATE_FILE: 'fs:createFile',
  FS_CREATE_DIR: 'fs:createDir',
  FS_RENAME: 'fs:rename',
  FS_DELETE: 'fs:delete',
  FS_DUPLICATE: 'fs:duplicate',
  FS_MOVE: 'fs:move',
  FS_REVEAL: 'fs:reveal',
  FS_WATCH: 'fs:watch',
  FS_UNWATCH: 'fs:unwatch',
  FS_EVENT: 'fs:event',
  FS_READ_FILE: 'fs:readFile',
  GIT_STATUS: 'git:status',
  GIT_DIFF: 'git:diff',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  PTY_SPAWN: 'pty:spawn',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
  SHELLS_DETECT: 'shells:detect',
  CLAUDE_DETECT: 'claude:detect',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  RECENTS_GET: 'recents:get',
  RECENTS_ADD: 'recents:add',
  RECENTS_REMOVE: 'recents:remove',
  RECENTS_TOGGLE_PIN: 'recents:togglePin',
  CLIPBOARD_WRITE: 'clipboard:write',
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_HOME_DIR: 'app:getHomeDir',
  APP_CHECK_UPDATE: 'app:checkUpdate',
  APP_INSTALL_UPDATE: 'app:installUpdate',
  APP_OPEN_EXTERNAL: 'app:openExternal',
  GRAPH_BUILD: 'graph:build',
  BACKGROUND_PICK_IMAGE: 'background:pickImage',
  BACKGROUND_REMOVE: 'background:remove',
  BACKGROUND_REGENERATE: 'background:regenerate',
  THEME_EXPORT: 'theme:export',
  THEME_IMPORT: 'theme:import',
  SEARCH_RUN: 'search:run',
  SEARCH_CANCEL: 'search:cancel',
  SEARCH_RESULT: 'search:result',
  SEARCH_DONE: 'search:done',
  SEARCH_LIST_FILES: 'search:listFiles'
} as const
