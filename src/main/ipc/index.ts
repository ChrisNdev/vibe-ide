import { registerFsHandlers } from './fs'
import { registerGitHandlers } from './git'
import { registerPtyHandlers } from './pty'
import { registerSettingsHandlers } from './settings'
import { registerGraphHandlers } from './graph'
import { registerBackgroundHandlers } from './background'
import { registerSearchHandlers } from './search'
import { registerHooksHandlers } from './hooks'
import { registerTranscriptHandlers } from './transcript'
import { registerCheckpointsHandlers } from './checkpoints'

export function registerIpcHandlers(): void {
  registerFsHandlers()
  registerGitHandlers()
  registerPtyHandlers()
  registerSettingsHandlers()
  registerGraphHandlers()
  registerBackgroundHandlers()
  registerSearchHandlers()
  registerHooksHandlers()
  registerTranscriptHandlers()
  registerCheckpointsHandlers()
}
