import type { ConsoleErrorEntry } from '../shared/types'

/**
 * Ring buffer of console errors / failed requests captured from the dev-server
 * preview webview (Fase 8). Lives here, not in mcp-tools.ts, so Fase 8's webview
 * wiring and the MCP get_console_errors tool share one source without either
 * depending on the other's module.
 */

const MAX_ENTRIES = 200
let entries: ConsoleErrorEntry[] = []

function add(entry: ConsoleErrorEntry): void {
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
}

function get(): ConsoleErrorEntry[] {
  return entries
}

function clear(): void {
  entries = []
}

export const consoleErrorLog = { add, get, clear }
