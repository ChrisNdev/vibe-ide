import Store from 'electron-store'
import { AppSettings, BackgroundConfig, RecentProject } from '../shared/types'

interface StoreSchema {
  settings: AppSettings
  recents: RecentProject[]
  /** app.getVersion() as of the last launch — drives the once-per-update patch notes prompt */
  lastSeenVersion: string | null
}

export const DEFAULT_BACKGROUND: BackgroundConfig = {
  kind: 'none',
  imageId: null,
  gradientFrom: '#141210',
  gradientTo: '#2a2724',
  solidColor: '#141210',
  proceduralId: null,
  blur: 24,
  brightness: 1,
  saturation: 1,
  veil: 0.72,
  surfaceAlpha: 0.78,
  spot: '#c4457f',
  contrastGuaranteed: true,
  terminalTranslucent: false,
  useSystemWallpaper: false
}

export const DEFAULT_NOTIFICATIONS = { enabled: true, sound: true }

export const store = new Store<StoreSchema>({
  defaults: {
    settings: {
      claudeCommand: 'claude',
      defaultShellId: null,
      fontSize: 14,
      theme: 'dark',
      sidebarWidth: 280,
      sidebarCollapsed: false,
      background: DEFAULT_BACKGROUND,
      notifications: DEFAULT_NOTIFICATIONS
    },
    recents: [],
    lastSeenVersion: null
  }
})

/**
 * electron-store only applies `defaults` when the `settings` key is missing
 * entirely — it won't backfill new sub-fields (like `background`) into a
 * settings object that already exists on disk from before this field existed.
 * Read through this instead of `store.get('settings')` directly so upgrading
 * users don't end up with `settings.background`/`notifications` undefined.
 */
export function getSettings(): AppSettings {
  const current = store.get('settings')
  if (current.background && current.notifications) return current
  const patched: AppSettings = {
    ...current,
    background: current.background ?? DEFAULT_BACKGROUND,
    notifications: current.notifications ?? DEFAULT_NOTIFICATIONS
  }
  store.set('settings', patched)
  return patched
}
