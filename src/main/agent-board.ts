import { BrowserWindow } from 'electron'
import { hookEvents } from './hooks-server'
import { IPC, HookEvent, AgentStatus } from '../shared/types'

/** Per-worktree (keyed by cwd) agent status, derived purely from hook events — no polling. */
const statusByPath = new Map<string, AgentStatus>()

export function statusFor(worktreePath: string): AgentStatus {
  return statusByPath.get(worktreePath) ?? 'idle'
}

export function wireAgentBoard(getWindow: () => BrowserWindow | null): void {
  hookEvents.on('event', (evt: HookEvent) => {
    const cwd = typeof evt.cwd === 'string' ? evt.cwd : null
    if (!cwd) return

    let next: AgentStatus | null = null
    if (evt.hook_event_name === 'UserPromptSubmit') next = 'running'
    else if (evt.hook_event_name === 'Notification') next = 'waiting'
    else if (evt.hook_event_name === 'Stop') next = 'idle'
    if (!next) return

    statusByPath.set(cwd, next)
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.WORKTREE_STATUS_EVENT, { path: cwd, status: next })
    }
  })
}
