import { Notification, BrowserWindow } from 'electron'
import { hookEvents } from './hooks-server'
import { getSettings } from './store'
import { IPC, HookEvent } from '../shared/types'

const TITLES: Record<string, string> = {
  Stop: 'Claude terminou o turno',
  Notification: 'Claude precisa de você'
}

function messageFor(evt: HookEvent): string {
  if (typeof evt.message === 'string') return evt.message
  if (evt.hook_event_name === 'Stop') return 'A resposta terminou — volte pra conferir.'
  return 'Aguardando sua entrada.'
}

/**
 * Forwards every hook event to the renderer (control strip, future panels) and,
 * for Stop/Notification, fires a desktop notification — but only when the
 * window isn't focused, so it doesn't nag while you're already looking at it.
 */
export function wireHookNotifications(getWindow: () => BrowserWindow | null): void {
  hookEvents.on('event', (evt: HookEvent) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.HOOKS_EVENT, evt)
    }

    if (evt.hook_event_name !== 'Stop' && evt.hook_event_name !== 'Notification') return
    const settings = getSettings()
    if (!settings.notifications.enabled) return
    if (win && win.isFocused()) return

    const notification = new Notification({
      title: TITLES[evt.hook_event_name] ?? 'vibeIDE',
      body: messageFor(evt),
      silent: !settings.notifications.sound
    })
    notification.on('click', () => {
      if (win && !win.isDestroyed()) {
        win.show()
        win.focus()
      }
    })
    notification.show()
  })
}
