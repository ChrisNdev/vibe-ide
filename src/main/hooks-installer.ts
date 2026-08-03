import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import type { HooksInstallResult } from '../shared/types'

const MANAGED_EVENTS = ['UserPromptSubmit', 'Stop', 'Notification'] as const

/**
 * Reads Claude Code's hook JSON from stdin and POSTs it to whatever local
 * vibeIDE instance is currently running — discovered fresh on every invocation
 * via userData/hooks-endpoint.json, since the port is ephemeral and this script
 * is installed once. If vibeIDE isn't running, exits 0 immediately: a hook must
 * never block or fail Claude Code's turn.
 */
const HOOK_SCRIPT_SOURCE = `#!/usr/bin/env node
'use strict';
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

function userDataDir() {
  const appName = 'vibe-ide';
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), appName);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName);
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), appName);
}

let input = '';
process.stdin.on('data', (c) => { input += c; });
process.stdin.on('end', () => {
  const done = () => process.exit(0);
  let endpoint;
  try {
    endpoint = JSON.parse(fs.readFileSync(path.join(userDataDir(), 'hooks-endpoint.json'), 'utf-8'));
  } catch {
    return done();
  }
  try {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: endpoint.port,
        path: '/hook',
        method: 'POST',
        timeout: 800,
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + endpoint.token }
      },
      (res) => { res.resume(); }
    );
    req.on('error', () => {});
    req.on('timeout', () => req.destroy());
    req.end(input);
  } catch {
    // fall through to the timed exit below regardless
  }
  setTimeout(done, 1000);
});
process.stdin.on('error', () => process.exit(0));
`

function claudeDir(rootPath: string): string {
  return path.join(rootPath, '.claude')
}
function hookScriptPath(rootPath: string): string {
  return path.join(claudeDir(rootPath), 'hooks', 'vibeide-notify.cjs')
}
function settingsLocalPath(rootPath: string): string {
  return path.join(claudeDir(rootPath), 'settings.local.json')
}
function backupPath(rootPath: string): string {
  return path.join(claudeDir(rootPath), 'settings.local.json.vibeide-backup')
}
function markerPath(rootPath: string): string {
  return path.join(claudeDir(rootPath), '.vibeide-hooks-installed')
}

async function readJsonIfExists(p: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf-8'))
  } catch {
    return null
  }
}

export function hooksInstalled(rootPath: string): boolean {
  return fsSync.existsSync(markerPath(rootPath))
}

export async function installHooks(rootPath: string): Promise<HooksInstallResult> {
  try {
    const hooksDir = path.join(claudeDir(rootPath), 'hooks')
    await fs.mkdir(hooksDir, { recursive: true })
    await fs.writeFile(hookScriptPath(rootPath), HOOK_SCRIPT_SOURCE, 'utf-8')

    const settingsPath = settingsLocalPath(rootPath)
    const existed = fsSync.existsSync(settingsPath)
    if (existed) {
      await fs.copyFile(settingsPath, backupPath(rootPath))
    }

    const current = (await readJsonIfExists(settingsPath)) ?? {}
    const hooks = (current.hooks as Record<string, unknown>) ?? {}
    current.hooks = hooks
    const command = `node "${hookScriptPath(rootPath)}"`

    for (const evt of MANAGED_EVENTS) {
      const groups = (hooks[evt] as { hooks?: { type: string; command: string }[] }[]) ?? []
      hooks[evt] = groups
      const alreadyThere = groups.some((g) => g.hooks?.some((h) => h.command === command))
      if (!alreadyThere) groups.push({ hooks: [{ type: 'command', command }] })
    }

    await fs.writeFile(settingsPath, JSON.stringify(current, null, 2), 'utf-8')
    await fs.writeFile(markerPath(rootPath), existed ? 'existed' : 'created', 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Restores settings.local.json byte-for-byte to what it was before install (or removes it if it didn't exist). */
export async function uninstallHooks(rootPath: string): Promise<HooksInstallResult> {
  try {
    const settingsPath = settingsLocalPath(rootPath)
    const bkp = backupPath(rootPath)
    if (fsSync.existsSync(bkp)) {
      await fs.copyFile(bkp, settingsPath)
      await fs.unlink(bkp)
    } else {
      await fs.unlink(settingsPath).catch(() => {})
    }
    await fs.unlink(markerPath(rootPath)).catch(() => {})
    await fs.unlink(hookScriptPath(rootPath)).catch(() => {})
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
