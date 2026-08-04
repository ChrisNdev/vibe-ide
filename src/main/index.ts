import { app, shell, BrowserWindow, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { killAllPtys } from './pty-manager'
import { registerBackgroundProtocol } from './background-processor'
import { getSettings } from './store'
import { startHooksServer, stopHooksServer } from './hooks-server'
import { wireHookNotifications } from './notifications'
import { wireCheckpointCreation } from './checkpoint-listener'
import { startMcpServer, stopMcpServer } from './mcp-server'
import { wireAgentBoard } from './agent-board'
import { IPC } from '../shared/types'

// Hardware acceleration is intentionally left ON. Some machines (VMs, RDP sessions,
// IoT/embedded Windows editions) have a GPU process that never produces a composited
// frame, which used to mean 'ready-to-show' — and therefore win.show() — never fired.
// That's now handled below instead: a did-finish-load fallback shows the window on a
// timer regardless of compositor state, so the same VM/IoT case is covered without
// forcing every machine onto slow CPU-rasterized rendering (blur, WebGL terminal, and
// general compositing all pay for that unconditionally otherwise).

// file:// doesn't resolve with sandbox: true, so background images are served over
// our own scheme. Must be flagged privileged before the app is ready; the actual
// request handler (registerBackgroundProtocol) is wired up after.
protocol.registerSchemesAsPrivileged([
  { scheme: 'vibe', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
])

function createWindow(): BrowserWindow {
  const { useSystemWallpaper } = getSettings().background
  // Mica needs the DWM compositor, which needs hardware acceleration — and that's
  // disabled above for VM/RDP compatibility, so this option is a documented no-op
  // there. It only actually renders on real Windows 11 hardware in the future if
  // that tradeoff changes; wiring it now still saves the setting correctly.
  const useMica = process.platform === 'win32' && useSystemWallpaper

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    // Mirrors --substrate / --muted from src/renderer/src/styles/tokens.css — the main
    // process can't read a CSS custom property, so the token's literal value lives here too.
    backgroundColor: '#1c1c1e',
    autoHideMenuBar: true,
    // Fully frameless — no titleBarOverlay. That gave Windows a reserved 36px zone at the
    // top-right for its own min/max/close, which collided with this app's own toolbar buttons
    // living in the same corner (native chrome always painting on top, so nothing drawn there
    // was reliably visible or clickable) and looked visually bolted-on next to the rest of the
    // glass UI. TitleBar.tsx (renderer) draws real min/max/close now, matching the app itself.
    titleBarStyle: 'hidden',
    ...(useMica ? { backgroundMaterial: 'mica' as const, transparent: true } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // Only for the Fase 8 verification panel's embedded dev-server preview —
      // hardened below (will-attach-webview + per-webview navigation lockdown).
      webviewTag: true
    }
  })

  // <webview> hardening (INVARIANTES — Fase 8 segurança do webview): a compromised
  // renderer could otherwise ask for nodeIntegration/preload on the webview itself,
  // so every attempt is forced back to safe defaults regardless of what was requested.
  win.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = true
    delete webPreferences.preload
    delete (webPreferences as { preloadURL?: string }).preloadURL
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(params.src)) {
      params.src = 'about:blank'
    }
  })
  win.webContents.on('did-attach-webview', (_event, webContents) => {
    webContents.setWindowOpenHandler(() => ({ action: 'deny' })) // allowpopups stays off
    webContents.on('will-navigate', (navEvent, url) => {
      if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) navEvent.preventDefault()
    })
  })

  // Keeps TitleBar.tsx's maximize/restore icon in sync, including when the user double-clicks
  // the title bar or drags the window to a screen edge (Windows' own snap gesture) — neither
  // goes through the toggleMaximize IPC call, so the renderer needs to be told, not asked.
  win.on('maximize', () => win.webContents.send(IPC.WINDOW_MAXIMIZE_CHANGED, true))
  win.on('unmaximize', () => win.webContents.send(IPC.WINDOW_MAXIMIZE_CHANGED, false))

  const showOnce = (): void => {
    if (!win.isDestroyed() && !win.isVisible()) win.show()
  }

  win.on('ready-to-show', showOnce)
  // Fallback in case the compositor never reports ready (VM/RDP/IoT GPU quirks — see the
  // hardware-acceleration comment at the top of this file). did-finish-load fires on page
  // load regardless of compositor state, so the window still shows up on a timer either way.
  win.webContents.once('did-finish-load', () => setTimeout(showOnce, 1500))

  if (is.dev) {
    win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
    })
  }

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.christian.vibeide')

  app.on('browser-window-created', (_, win) => {
    optimizer.watchWindowShortcuts(win)
  })

  registerIpcHandlers()
  registerBackgroundProtocol()
  startHooksServer()
  void startMcpServer()
  wireHookNotifications(() => BrowserWindow.getAllWindows()[0] ?? null)
  wireCheckpointCreation(() => BrowserWindow.getAllWindows()[0] ?? null)
  wireAgentBoard(() => BrowserWindow.getAllWindows()[0] ?? null)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  killAllPtys()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  killAllPtys()
  stopHooksServer()
  stopMcpServer()
})
