import Store from 'electron-store'
import { AppSettings, RecentProject } from '../shared/types'

interface StoreSchema {
  settings: AppSettings
  recents: RecentProject[]
}

export const store = new Store<StoreSchema>({
  defaults: {
    settings: {
      claudeCommand: 'claude',
      defaultShellId: null,
      fontSize: 14,
      theme: 'dark',
      sidebarWidth: 280,
      sidebarCollapsed: false
    },
    recents: []
  }
})
