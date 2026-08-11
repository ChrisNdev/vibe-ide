import { spawn, ChildProcessByStdio, execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fsSync from 'fs'
import { app } from 'electron'
import type { Readable } from 'stream'
import { SearchOptions, SearchMatch } from '../shared/types'

const execFileAsync = promisify(execFile)

/**
 * @vscode/ripgrep ships as a pure ESM package ("type": "module") with no CJS
 * build, so it can't be `require()`d from this CJS main-process bundle. Its
 * own lib/index.js does nothing more than a require.resolve() against the
 * platform-specific optionalDependency — that alone isn't enough in a packaged
 * build though: electron-builder auto-unpacks rg.exe from the asar (it can't
 * run from inside the archive), and npm nests that optionalDependency under
 * @vscode/ripgrep's own node_modules instead of hoisting it, so require.resolve()
 * from this bundle's location misses it entirely. Resolved lazily (not at module
 * load) so a resolution miss degrades to "search returns nothing" instead of
 * crashing the whole app on startup.
 */
function resolveRgPath(): string {
  const binaryName = process.platform === 'win32' ? 'rg.exe' : 'rg'
  const platformPkg = `@vscode/ripgrep-${process.platform}-${process.arch}`
  if (app.isPackaged) {
    const candidates = [
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@vscode', 'ripgrep', 'node_modules', platformPkg, 'bin', binaryName),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', platformPkg, 'bin', binaryName)
    ]
    const found = candidates.find((c) => fsSync.existsSync(c))
    if (found) return found
  }
  try {
    return require.resolve(`${platformPkg}/bin/${binaryName}`)
  } catch {
    return binaryName // last resort: hope it's on PATH — spawn/execFile's own error handling takes it from here
  }
}

let cachedRgPath: string | null = null
function getRgPath(): string {
  if (!cachedRgPath) cachedRgPath = resolveRgPath()
  return cachedRgPath
}

const MAX_RESULTS = 500
/** How often partial matches get flushed to the renderer — keeps a 10k-file repo feeling instant without a message per match. */
const BATCH_INTERVAL_MS = 80
const MAX_FILE_SIZE = '2M'

type SearchProcess = ChildProcessByStdio<null, Readable, Readable>

/** One active rg process per window — starting a new search kills whatever that window was already running. */
const activeSearches = new Map<number, SearchProcess>()

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

function buildSearchArgs(opts: SearchOptions): string[] {
  const args = ['--json', '--max-filesize', MAX_FILE_SIZE, '--max-count', '200']
  if (!opts.caseSensitive) args.push('--ignore-case')
  if (!opts.regex) args.push('--fixed-strings')
  if (!opts.respectGitignore) args.push('--no-ignore')
  if (opts.includeGlob.trim()) args.push('--glob', opts.includeGlob.trim())
  if (opts.excludeGlob.trim()) args.push('--glob', `!${opts.excludeGlob.trim()}`)
  // Explicit "." path — without it, rg can decide stdin isn't a TTY (always true
  // under spawn()) and wait to read the search target from stdin instead, which
  // then hangs forever since nothing ever writes to or closes that pipe.
  args.push('--', opts.query, '.')
  return args
}

interface RgJsonMatch {
  type: 'match'
  data: {
    path: { text: string }
    lines: { text: string }
    line_number: number
    submatches: { start: number; end: number }[]
  }
}

function parseLine(line: string): RgJsonMatch | null {
  if (!line) return null
  try {
    const obj = JSON.parse(line)
    return obj.type === 'match' ? (obj as RgJsonMatch) : null
  } catch {
    return null
  }
}

export function cancelSearch(windowId: number): void {
  const proc = activeSearches.get(windowId)
  if (proc) {
    proc.kill()
    activeSearches.delete(windowId)
  }
}

export function runSearch(
  windowId: number,
  rootPath: string,
  opts: SearchOptions,
  onResults: (matches: SearchMatch[]) => void,
  onDone: (total: number, truncated: boolean, cancelled: boolean) => void
): void {
  cancelSearch(windowId)

  if (!opts.query.trim()) {
    onDone(0, false, false)
    return
  }

  // stdin: 'ignore' closes it immediately — belt-and-suspenders against the stdin-hang above.
  const proc = spawn(getRgPath(), buildSearchArgs(opts), { cwd: rootPath, stdio: ['ignore', 'pipe', 'pipe'] })
  activeSearches.set(windowId, proc)

  let buffer = ''
  let total = 0
  let truncated = false
  let batch: SearchMatch[] = []
  let batchTimer: ReturnType<typeof setInterval> | null = null

  const flush = (): void => {
    if (batch.length === 0) return
    onResults(batch)
    batch = []
  }

  batchTimer = setInterval(flush, BATCH_INTERVAL_MS)

  proc.stdout.on('data', (chunk: Buffer) => {
    if (truncated) return
    buffer += chunk.toString('utf-8')
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const parsed = parseLine(line)
      if (!parsed) continue
      const { data } = parsed
      const sub = data.submatches[0]
      if (!sub) continue
      batch.push({
        file: path.join(rootPath, toPosix(data.path.text)),
        line: data.line_number,
        matchStart: sub.start,
        matchEnd: sub.end,
        lineText: data.lines.text.replace(/\r?\n$/, '')
      })
      total++
      if (total >= MAX_RESULTS) {
        truncated = true
        proc.kill()
        break
      }
    }
  })

  // 'error' (rg missing / not executable) is followed by 'close', so both fire for the same
  // search — without this latch the renderer gets two SEARCH_DONE events and stops showing
  // the spinner for a search that's still running after it, one result set behind.
  let finished = false
  const finish = (cancelled: boolean): void => {
    if (finished) return
    finished = true
    if (batchTimer) clearInterval(batchTimer)
    flush()
    if (activeSearches.get(windowId) === proc) activeSearches.delete(windowId)
    onDone(total, truncated, cancelled)
  }

  proc.on('close', (_code, signal) => finish(signal === 'SIGTERM' && !truncated))
  proc.on('error', () => finish(false))
}

/** Full file listing for the quick-open palette — same binary, respects .gitignore by default. */
export async function listFiles(rootPath: string): Promise<string[]> {
  try {
    // Explicit "." path for the same reason as buildSearchArgs above — avoids rg
    // second-guessing whether it should read the file list target from stdin.
    const { stdout } = await execFileAsync(getRgPath(), ['--files', '.'], { cwd: rootPath, maxBuffer: 64 * 1024 * 1024 })
    return stdout
      .split('\n')
      .map((l) => toPosix(l.trim()))
      .filter(Boolean)
      .slice(0, 20000)
  } catch {
    return []
  }
}
