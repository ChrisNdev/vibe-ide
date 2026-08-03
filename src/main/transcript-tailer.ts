import fs from 'fs'
import fsp from 'fs/promises'
import readline from 'readline'
import path from 'path'
import os from 'os'
import chokidar, { FSWatcher } from 'chokidar'
import { TranscriptState, TranscriptToolCall, TranscriptTodo, TranscriptUsagePoint, TranscriptSessionSummary } from '../shared/types'

const MAX_TOOL_CALLS = 300
const MAX_USAGE_POINTS = 500
/** Above this failure ratio, the schema is treated as unrecognized — parse defensivo obrigatório. */
const UNRECOGNIZED_THRESHOLD = 0.2

/** Mirrors Claude Code's own project-dir encoding: every non-alphanumeric char becomes "-". */
function encodeProjectDir(rootPath: string): string {
  return rootPath.replace(/[^a-zA-Z0-9]/g, '-')
}

function transcriptsDir(rootPath: string): string {
  return path.join(os.homedir(), '.claude', 'projects', encodeProjectDir(rootPath))
}

interface ParsedLine {
  type?: string
  uuid?: string
  parentUuid?: string
  timestamp?: string
  isSidechain?: boolean
  gitBranch?: string
  message?: {
    role?: string
    content?: unknown
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
}

interface ContentBlock {
  type?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  is_error?: boolean
  text?: string
}

const FILE_PATH_KEYS = ['file_path', 'path', 'notebook_path']

function extractTouchedPath(input: Record<string, unknown> | undefined): string | null {
  if (!input) return null
  for (const key of FILE_PATH_KEYS) {
    const v = input[key]
    if (typeof v === 'string') return v
  }
  return null
}

/** Mutable accumulator kept per watched session — new lines are folded in incrementally, never rebuilt from scratch. */
class SessionAccumulator {
  toolCalls: TranscriptToolCall[] = []
  todos: TranscriptTodo[] = []
  usage: TranscriptUsagePoint[] = []
  touchedFiles = new Set<string>()
  totalLines = 0
  failedLines = 0
  private errorByToolUseId = new Map<string, boolean>()

  get unrecognizedFormat(): boolean {
    return this.totalLines >= 20 && this.failedLines / this.totalLines > UNRECOGNIZED_THRESHOLD
  }

  /** Never throws — a malformed line is counted and skipped, per INVARIANTES-style parse defensivo. */
  ingestLine(raw: string): void {
    const line = raw.trim()
    if (!line) return
    this.totalLines++
    let parsed: ParsedLine
    try {
      parsed = JSON.parse(line)
    } catch {
      this.failedLines++
      return
    }
    try {
      this.ingestParsed(parsed)
    } catch {
      // a well-formed JSON line with an unexpected inner shape still counts as a failure to interpret
      this.failedLines++
    }
  }

  private ingestParsed(parsed: ParsedLine): void {
    if (parsed.type === 'user') {
      const content = parsed.message?.content
      if (Array.isArray(content)) {
        for (const block of content as ContentBlock[]) {
          if (block?.type === 'tool_result' && block.tool_use_id) {
            this.errorByToolUseId.set(block.tool_use_id, !!block.is_error)
          }
        }
      }
      return
    }

    if (parsed.type !== 'assistant') return
    const content = parsed.message?.content
    if (!Array.isArray(content)) return

    for (const block of content as ContentBlock[]) {
      if (block?.type !== 'tool_use' || !block.name || !block.id) continue
      const call: TranscriptToolCall = {
        id: block.id,
        uuid: parsed.uuid ?? block.id,
        name: block.name,
        input: block.input ?? {},
        timestamp: parsed.timestamp ?? new Date().toISOString(),
        isSidechain: !!parsed.isSidechain,
        isError: this.errorByToolUseId.get(block.id) ?? false
      }
      this.toolCalls.push(call)
      if (this.toolCalls.length > MAX_TOOL_CALLS) this.toolCalls.shift()

      if (block.name === 'TodoWrite' && Array.isArray(block.input?.todos)) {
        this.todos = block.input.todos as TranscriptTodo[]
      }

      const touched = extractTouchedPath(block.input)
      if (touched) this.touchedFiles.add(touched)
    }

    const usage = parsed.message?.usage
    if (usage) {
      this.usage.push({
        timestamp: parsed.timestamp ?? new Date().toISOString(),
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0
      })
      if (this.usage.length > MAX_USAGE_POINTS) this.usage.shift()
    }
  }

  toState(sessionId: string): TranscriptState {
    return {
      sessionId,
      toolCalls: this.toolCalls,
      todos: this.todos,
      usage: this.usage,
      touchedFiles: [...this.touchedFiles],
      totalLines: this.totalLines,
      failedLines: this.failedLines,
      unrecognizedFormat: this.unrecognizedFormat
    }
  }
}

interface WatchHandle {
  watcher: FSWatcher
  filePath: string
  offset: number
  accumulator: SessionAccumulator
  reading: boolean
}

const activeWatches = new Map<number, WatchHandle>()

async function pickMostRecentSession(dir: string): Promise<string | null> {
  try {
    const entries = await fsp.readdir(dir)
    const jsonl = entries.filter((f) => f.endsWith('.jsonl'))
    if (jsonl.length === 0) return null
    const withStats = await Promise.all(
      jsonl.map(async (f) => ({ f, mtime: (await fsp.stat(path.join(dir, f))).mtimeMs }))
    )
    withStats.sort((a, b) => b.mtime - a.mtime)
    return withStats[0].f
  } catch {
    return null
  }
}

/** Reads new bytes since the tracked offset and folds complete lines into the accumulator. Never re-reads earlier bytes. */
async function readIncrement(handle: WatchHandle, onUpdate: (state: TranscriptState) => void): Promise<void> {
  if (handle.reading) return
  handle.reading = true
  try {
    const stat = await fsp.stat(handle.filePath)
    if (stat.size <= handle.offset) return
    const stream = fs.createReadStream(handle.filePath, { start: handle.offset, encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
    for await (const line of rl) {
      handle.accumulator.ingestLine(line)
    }
    handle.offset = stat.size
    onUpdate(handle.accumulator.toState(path.basename(handle.filePath, '.jsonl')))
  } catch {
    // transient read error (file rotated mid-read, etc.) — next chokidar event will retry
  } finally {
    handle.reading = false
  }
}

export async function watchSession(
  windowId: number,
  rootPath: string,
  onUpdate: (state: TranscriptState) => void
): Promise<{ ok: boolean; sessionId?: string }> {
  unwatchSession(windowId)
  const dir = transcriptsDir(rootPath)
  const sessionFile = await pickMostRecentSession(dir)
  if (!sessionFile) return { ok: false }

  const filePath = path.join(dir, sessionFile)
  const accumulator = new SessionAccumulator()
  const handle: WatchHandle = { watcher: chokidar.watch(filePath, { ignoreInitial: true }), filePath, offset: 0, accumulator, reading: false }
  activeWatches.set(windowId, handle)

  handle.watcher.on('change', () => void readIncrement(handle, onUpdate))
  handle.watcher.on('error', () => {
    // a watch error just means live updates stop; the initial read below already gave the panel something to show
  })

  await readIncrement(handle, onUpdate)
  return { ok: true, sessionId: path.basename(sessionFile, '.jsonl') }
}

export function unwatchSession(windowId: number): void {
  const handle = activeWatches.get(windowId)
  if (handle) {
    void handle.watcher.close()
    activeWatches.delete(windowId)
  }
}

function firstUserMessagePreview(filePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8', end: 8000 })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
    let resolved = false
    const finish = (value: string | null): void => {
      if (resolved) return
      resolved = true
      rl.close()
      stream.destroy()
      resolve(value)
    }
    rl.on('line', (line) => {
      try {
        const parsed = JSON.parse(line) as ParsedLine
        if (parsed.type !== 'user' || !parsed.message) return
        const content = parsed.message.content
        if (typeof content === 'string' && !content.startsWith('<')) {
          finish(content.slice(0, 140))
        }
      } catch {
        // keep scanning — one bad line at the top of the file shouldn't blank the label
      }
    })
    rl.on('close', () => finish(null))
    stream.on('error', () => finish(null))
  })
}

export async function listSessions(rootPath: string): Promise<TranscriptSessionSummary[]> {
  const dir = transcriptsDir(rootPath)
  try {
    const entries = await fsp.readdir(dir)
    const jsonl = entries.filter((f) => f.endsWith('.jsonl'))
    const summaries = await Promise.all(
      jsonl.map(async (f) => {
        const full = path.join(dir, f)
        const stat = await fsp.stat(full)
        const preview = await firstUserMessagePreview(full)
        return {
          id: path.basename(f, '.jsonl'),
          mtimeMs: stat.mtimeMs,
          sizeBytes: stat.size,
          firstUserMessage: preview,
          gitBranch: null
        }
      })
    )
    summaries.sort((a, b) => b.mtimeMs - a.mtimeMs)
    return summaries
  } catch {
    return []
  }
}
