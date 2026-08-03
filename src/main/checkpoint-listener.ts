import { BrowserWindow } from 'electron'
import { hookEvents } from './hooks-server'
import { createCheckpoint } from './checkpoint-manager'
import { IPC, HookEvent, CheckpointMeta } from '../shared/types'

const CHECKPOINT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit'])

function labelFor(toolName: string, input: Record<string, unknown>): string {
  const filePath = input.file_path
  if (typeof filePath === 'string') {
    const name = filePath.split(/[\\/]/).pop()
    return `${toolName} ${name}`
  }
  return toolName
}

/** PreToolUse fires before Edit/Write/MultiEdit — snapshot the working tree first, silently. */
export function wireCheckpointCreation(getWindow: () => BrowserWindow | null): void {
  hookEvents.on('event', (evt: HookEvent) => {
    if (evt.hook_event_name !== 'PreToolUse') return
    const toolName = typeof evt.tool_name === 'string' ? evt.tool_name : ''
    if (!CHECKPOINT_TOOLS.has(toolName)) return
    const cwd = typeof evt.cwd === 'string' ? evt.cwd : null
    if (!cwd) return

    const input = (evt.tool_input as Record<string, unknown>) ?? {}
    void createCheckpoint(cwd, toolName, labelFor(toolName, input))
      .then((result) => {
        if (!result.meta) return
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send(IPC.CHECKPOINTS_EVENT, result.meta as CheckpointMeta)
        }
      })
      .catch(() => {
        // best-effort — a failed checkpoint must never surface as an error to the agent/hook
      })
  })
}
