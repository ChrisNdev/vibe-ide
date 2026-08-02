import chokidar, { FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { IPC, FsWatchEvent } from '../shared/types'

const watchers = new Map<string, FSWatcher>()

const IGNORED = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/out/**',
  '**/.next/**',
  '**/build/**',
  '**/.cache/**'
]

export function watchPath(win: BrowserWindow, rootPath: string): void {
  unwatchPath(rootPath)

  const watcher = chokidar.watch(rootPath, {
    ignored: IGNORED,
    ignoreInitial: true,
    depth: 20,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 }
  })

  const emit = (type: FsWatchEvent['type']) => (path: string) => {
    if (!win.isDestroyed()) win.webContents.send(IPC.FS_EVENT, { type, path } as FsWatchEvent)
  }

  watcher
    .on('add', emit('add'))
    .on('addDir', emit('addDir'))
    .on('unlink', emit('unlink'))
    .on('unlinkDir', emit('unlinkDir'))
    .on('change', emit('change'))
    .on('error', () => {
      // permission-restricted subfolders (e.g. OS junction points on Windows)
      // are expected and shouldn't take down the watcher or the process
    })

  watchers.set(rootPath, watcher)
}

export function unwatchPath(rootPath: string): void {
  const w = watchers.get(rootPath)
  if (w) {
    w.close()
    watchers.delete(rootPath)
  }
}

export function unwatchAll(): void {
  for (const path of Array.from(watchers.keys())) unwatchPath(path)
}
