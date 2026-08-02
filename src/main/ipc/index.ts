import { registerFsHandlers } from './fs'
import { registerGitHandlers } from './git'
import { registerPtyHandlers } from './pty'
import { registerSettingsHandlers } from './settings'
import { registerGraphHandlers } from './graph'

export function registerIpcHandlers(): void {
  registerFsHandlers()
  registerGitHandlers()
  registerPtyHandlers()
  registerSettingsHandlers()
  registerGraphHandlers()
}
