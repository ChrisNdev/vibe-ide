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

export interface AppSettings {
  claudeCommand: string
  defaultShellId: string | null
  fontSize: number
  theme: 'dark' | 'light'
  sidebarWidth: number
  sidebarCollapsed: boolean
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
  GRAPH_BUILD: 'graph:build'
} as const
