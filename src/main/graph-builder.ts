import fs from 'fs/promises'
import fsSync from 'fs'
import crypto from 'crypto'
import path from 'path'
import { app } from 'electron'
import type { parseSync as ParseSyncFn } from 'oxc-parser'
import { GraphNode, GraphEdge, ProjectGraph } from '../shared/types'
import { createIgnoreMatcher } from './gitignore'

/**
 * Builds a "mind map" of a project's internal file relationships purely via
 * local filesystem reads + AST/regex import parsing — no LLM/AI calls involved,
 * so visualizing the project structure never costs API tokens.
 */

/**
 * oxc-parser ships ESM-only. The main process is bundled to CommonJS, and the
 * `externalizeDepsPlugin` keeps it out of that bundle entirely, so a plain
 * `import`/`require('oxc-parser')` fails under Electron's embedded Node with
 * ERR_REQUIRE_ESM. A real dynamic `import()` works — but written directly it'd
 * get rewritten back into a `require()` by the TS/Rollup build step, so it's
 * hidden behind `Function(...)` where no bundler can see and "helpfully" rewrite it.
 */
let oxcParserPromise: Promise<{ parseSync: typeof ParseSyncFn }> | null = null
function loadOxcParser(): Promise<{ parseSync: typeof ParseSyncFn }> {
  if (!oxcParserPromise) {
    // eslint-disable-next-line no-new-func
    oxcParserPromise = new Function('return import("oxc-parser")')() as Promise<{ parseSync: typeof ParseSyncFn }>
  }
  return oxcParserPromise
}

const JS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.vue'])
const PY_EXTENSIONS = new Set(['.py'])
const CODE_EXTENSIONS = new Set([...JS_EXTENSIONS, ...PY_EXTENSIONS])

/** Extra always-ignored dirs beyond what .gitignore covers — heavy even in repos that don't gitignore them. */
const IGNORE_DIRS = new Set(['dist', 'build', 'out', '.next', '.nuxt', '.turbo', '.cache', 'coverage', '.vscode', '.idea', 'venv', '.venv', '__pycache__', '.pytest_cache'])

const MAX_FILES = 2500
const MAX_FILE_SIZE = 512 * 1024
/** caps concurrent fs operations so a huge repo can't blow past the OS file-handle limit (or just thrash the disk) */
const FS_CONCURRENCY = 64

/** oxc-parser's module info covers ESM import/export/dynamic-import, but not CommonJS `require()` (it's a plain call, not module syntax) — kept as a narrow regex just for that one case. */
const REQUIRE_RE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g
const PY_IMPORT_RE = /^\s*from\s+(\.+[\w.]*)\s+import|^\s*import\s+([\w.]+)/gm
const VUE_SCRIPT_RE = /<script([^>]*)>([\s\S]*?)<\/script>/i

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

/** Bounded-concurrency gate: at most `limit` of the wrapped tasks run at once, rest queue up. */
function createLimiter(limit: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let active = 0
  const queue: (() => void)[] = []
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = (): void => {
        active++
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--
            queue.shift()?.()
          })
      }
      if (active < limit) start()
      else queue.push(start)
    })
  }
}

/** Walks the tree with bounded fan-out — siblings recurse in parallel (through the shared limiter) instead of one directory at a time. */
async function collectFiles(
  dir: string,
  rootPath: string,
  files: string[],
  limit: <T>(fn: () => Promise<T>) => Promise<T>,
  ignored: (relPosixPath: string) => boolean
): Promise<void> {
  if (files.length >= MAX_FILES) return
  let entries
  try {
    entries = await limit(() => fs.readdir(dir, { withFileTypes: true }))
  } catch {
    return
  }
  const subdirs: string[] = []
  for (const entry of entries) {
    if (files.length >= MAX_FILES) break
    if (entry.name.startsWith('.') && !CODE_EXTENSIONS.has(path.extname(entry.name))) continue
    const full = path.join(dir, entry.name)
    const rel = toPosix(path.relative(rootPath, full))
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || ignored(rel)) continue
      subdirs.push(full)
    } else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name)) && !ignored(rel)) {
      files.push(full)
    }
  }
  await Promise.all(subdirs.map((sub) => collectFiles(sub, rootPath, files, limit, ignored)))
}

interface TsPathAlias {
  /** absolute dir the pattern's targets resolve against — the owning tsconfig's own baseUrl, not necessarily the project root */
  baseDir: string
  pattern: string
  targets: string[]
}

interface TsconfigJson {
  compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> }
  references?: { path: string }[]
}

function readJsonc(filePath: string): TsconfigJson | null {
  try {
    const raw = fsSync.readFileSync(filePath, 'utf-8')
    const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/,(\s*[}\]])/g, '$1')
    return JSON.parse(stripped) as TsconfigJson
  } catch {
    return null
  }
}

/**
 * ponytail: reads the root tsconfig.json plus one level of its `references` (the common
 * composite-project shape, e.g. an empty root config referencing tsconfig.web.json /
 * tsconfig.node.json) — no `extends` chains, no nested references. Upgrade path: recurse
 * into `extends`/deeper `references` if a project's paths live further away than that.
 */
function readTsPathAliases(rootPath: string): TsPathAlias[] {
  const aliases: TsPathAlias[] = []
  const rootConfigPath = path.join(rootPath, 'tsconfig.json')
  const rootJson = readJsonc(rootConfigPath)
  if (!rootJson) return aliases

  const configs: { json: TsconfigJson; dir: string }[] = [{ json: rootJson, dir: rootPath }]
  for (const ref of rootJson.references ?? []) {
    if (typeof ref?.path !== 'string') continue
    const resolved = path.resolve(rootPath, ref.path)
    const refConfigPath = resolved.endsWith('.json') ? resolved : path.join(resolved, 'tsconfig.json')
    const refJson = readJsonc(refConfigPath)
    if (refJson) configs.push({ json: refJson, dir: path.dirname(refConfigPath) })
  }

  for (const { json, dir } of configs) {
    const paths = json.compilerOptions?.paths
    if (!paths) continue
    const baseDir = path.resolve(dir, json.compilerOptions?.baseUrl ?? '.')
    for (const [pattern, targets] of Object.entries(paths)) aliases.push({ baseDir, pattern, targets })
  }
  return aliases
}

/** Resolves a bare specifier against tsconfig `paths` wildcard patterns, returning candidate absolute base paths (no extension) to try. */
function resolveTsAliasBases(spec: string, aliases: TsPathAlias[]): string[] {
  const bases: string[] = []
  for (const { baseDir, pattern, targets } of aliases) {
    const star = pattern.indexOf('*')
    if (star === -1) {
      if (pattern === spec) for (const t of targets) bases.push(path.resolve(baseDir, t))
      continue
    }
    const prefix = pattern.slice(0, star)
    const suffix = pattern.slice(star + 1)
    if (spec.startsWith(prefix) && spec.endsWith(suffix) && spec.length >= prefix.length + suffix.length) {
      const captured = spec.slice(prefix.length, spec.length - suffix.length)
      for (const t of targets) bases.push(path.resolve(baseDir, t.replace('*', captured)))
    }
  }
  return bases
}

function resolveJsImport(fromFile: string, spec: string, known: Set<string>, tsAliases: TsPathAlias[]): string | null {
  let bases: string[]
  if (spec.startsWith('.')) {
    bases = [path.resolve(path.dirname(fromFile), spec)]
  } else if (tsAliases.length > 0) {
    bases = resolveTsAliasBases(spec, tsAliases)
    if (bases.length === 0) return null
  } else {
    return null // external package — not part of the project mind map
  }
  for (const base of bases) {
    const candidates = [base, ...[...JS_EXTENSIONS].map((ext) => base + ext), ...[...JS_EXTENSIONS].map((ext) => path.join(base, 'index' + ext))]
    for (const candidate of candidates) {
      if (known.has(candidate)) return candidate
    }
  }
  return null
}

function resolvePyImport(fromFile: string, root: string, module: string, known: Set<string>): string | null {
  if (!module) return null
  let base: string
  if (module.startsWith('.')) {
    const dots = module.match(/^\.+/)?.[0].length ?? 1
    const rest = module.slice(dots).replace(/\./g, path.sep)
    let dir = path.dirname(fromFile)
    for (let i = 1; i < dots; i++) dir = path.dirname(dir)
    base = rest ? path.join(dir, rest) : dir
  } else {
    base = path.join(root, module.replace(/\./g, path.sep))
  }
  const candidates = [base + '.py', path.join(base, '__init__.py')]
  for (const candidate of candidates) {
    if (known.has(candidate)) return candidate
  }
  return null
}

/** Extracts raw import specifiers from a JS/TS/Vue file via oxc-parser's AST — handles re-exports and dynamic imports that regex missed. */
async function extractJsSpecs(filePath: string, content: string): Promise<string[]> {
  let code = content
  let virtualName = filePath
  if (filePath.endsWith('.vue')) {
    const m = content.match(VUE_SCRIPT_RE)
    if (!m) return []
    code = m[2]
    virtualName = filePath + (/lang=["']ts["']/i.test(m[1]) ? '.ts' : '.js')
  }

  const specs: string[] = []
  try {
    const { parseSync } = await loadOxcParser()
    const result = parseSync(virtualName, code)
    for (const imp of result.module.staticImports) specs.push(imp.moduleRequest.value)
    for (const exp of result.module.staticExports) {
      for (const entry of exp.entries) {
        if (entry.moduleRequest) specs.push(entry.moduleRequest.value)
      }
    }
    for (const dyn of result.module.dynamicImports) {
      const raw = code.slice(dyn.moduleRequest.start, dyn.moduleRequest.end)
      const literal = raw.match(/^['"](.+)['"]$/)
      if (literal) specs.push(literal[1])
    }
  } catch {
    // unparseable — fall through to whatever require() calls the regex below still finds
  }
  for (const match of code.matchAll(REQUIRE_RE)) specs.push(match[1])
  return specs
}

interface CacheEntry {
  mtimeMs: number
  size: number
  specs: string[]
}

function cacheFileFor(rootPath: string): string {
  const hash = crypto.createHash('md5').update(rootPath).digest('hex')
  return path.join(app.getPath('userData'), 'graph-cache', `${hash}.json`)
}

async function loadCache(rootPath: string): Promise<Record<string, CacheEntry>> {
  try {
    const raw = await fs.readFile(cacheFileFor(rootPath), 'utf-8')
    return (JSON.parse(raw)?.entries as Record<string, CacheEntry>) ?? {}
  } catch {
    return {}
  }
}

async function saveCache(rootPath: string, entries: Record<string, CacheEntry>): Promise<void> {
  try {
    const file = cacheFileFor(rootPath)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, JSON.stringify({ entries }), 'utf-8')
  } catch {
    // best-effort cache — a write failure just means the next build reparses everything
  }
}

/** Iterative DFS (explicit stack — avoids recursion-depth limits on large graphs) marking every node that sits on at least one import cycle. */
function detectCycles(nodeIds: string[], edges: GraphEdge[]): Set<string> {
  const adj = new Map<string, string[]>()
  for (const id of nodeIds) adj.set(id, [])
  for (const e of edges) adj.get(e.source)?.push(e.target)

  const color = new Map<string, 1 | 2>()
  const inCycle = new Set<string>()

  for (const start of nodeIds) {
    if (color.has(start)) continue
    const stack: { id: string; iter: number }[] = [{ id: start, iter: 0 }]
    color.set(start, 1)
    while (stack.length) {
      const frame = stack[stack.length - 1]
      const neighbors = adj.get(frame.id) ?? []
      if (frame.iter < neighbors.length) {
        const next = neighbors[frame.iter]
        frame.iter++
        const c = color.get(next)
        if (c === undefined) {
          color.set(next, 1)
          stack.push({ id: next, iter: 0 })
        } else if (c === 1) {
          const idx = stack.findIndex((f) => f.id === next)
          if (idx !== -1) for (let i = idx; i < stack.length; i++) inCycle.add(stack[i].id)
        }
      } else {
        color.set(frame.id, 2)
        stack.pop()
      }
    }
  }
  return inCycle
}

function detectOrphans(nodeIds: string[], edges: GraphEdge[]): Set<string> {
  const hasIncoming = new Set<string>()
  const hasOutgoing = new Set<string>()
  for (const e of edges) {
    hasOutgoing.add(e.source)
    hasIncoming.add(e.target)
  }
  const orphans = new Set<string>()
  for (const id of nodeIds) if (!hasIncoming.has(id) && !hasOutgoing.has(id)) orphans.add(id)
  return orphans
}

export async function buildProjectGraph(rootPath: string): Promise<ProjectGraph> {
  const limit = createLimiter(FS_CONCURRENCY)
  const ignored = createIgnoreMatcher(rootPath)
  const files: string[] = []
  await collectFiles(rootPath, rootPath, files, limit, ignored)
  const truncated = files.length >= MAX_FILES
  const known = new Set(files)
  const tsAliases = readTsPathAliases(rootPath)
  const prevCache = await loadCache(rootPath)
  const nextCache: Record<string, CacheEntry> = {}

  const nodes: GraphNode[] = files.map((full) => {
    const rel = toPosix(path.relative(rootPath, full))
    return {
      id: rel,
      label: path.basename(full),
      dir: toPosix(path.dirname(rel)),
      ext: path.extname(full),
      size: 0,
      tokenWeight: 0,
      orphan: false,
      inCycle: false
    }
  })
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  const edgeSet = new Set<string>()
  const edges: GraphEdge[] = []

  const addEdge = (sourceId: string, targetId: string): void => {
    const key = `${sourceId}->${targetId}`
    if (sourceId !== targetId && !edgeSet.has(key)) {
      edgeSet.add(key)
      edges.push({ source: sourceId, target: targetId, inCycle: false })
    }
  }

  await Promise.all(
    files.map((full) =>
      limit(async () => {
        let stat
        try {
          stat = await fs.stat(full)
        } catch {
          return
        }
        const sourceId = toPosix(path.relative(rootPath, full))
        const node = nodeById.get(sourceId)
        if (node) {
          node.size = stat.size
          node.tokenWeight = Math.max(1, Math.round(stat.size / 4))
        }
        if (stat.size > MAX_FILE_SIZE) return

        const cached = prevCache[sourceId]
        let specs: string[]
        if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
          specs = cached.specs
        } else {
          let content: string
          try {
            content = await fs.readFile(full, 'utf-8')
          } catch {
            return
          }
          const ext = path.extname(full)
          if (JS_EXTENSIONS.has(ext)) {
            specs = await extractJsSpecs(full, content)
          } else if (PY_EXTENSIONS.has(ext)) {
            specs = []
            for (const match of content.matchAll(PY_IMPORT_RE)) specs.push(match[1] ?? match[2])
          } else {
            specs = []
          }
        }
        nextCache[sourceId] = { mtimeMs: stat.mtimeMs, size: stat.size, specs }

        const ext = path.extname(full)
        if (JS_EXTENSIONS.has(ext)) {
          for (const spec of specs) {
            const resolved = resolveJsImport(full, spec, known, tsAliases)
            if (resolved) addEdge(sourceId, toPosix(path.relative(rootPath, resolved)))
          }
        } else if (PY_EXTENSIONS.has(ext)) {
          for (const module of specs) {
            const resolved = resolvePyImport(full, rootPath, module, known)
            if (resolved) addEdge(sourceId, toPosix(path.relative(rootPath, resolved)))
          }
        }
      })
    )
  )

  void saveCache(rootPath, nextCache)

  const nodeIds = nodes.map((n) => n.id)
  const cyclic = detectCycles(nodeIds, edges)
  const orphans = detectOrphans(nodeIds, edges)
  for (const n of nodes) {
    n.inCycle = cyclic.has(n.id)
    n.orphan = orphans.has(n.id)
  }
  // ponytail: an edge is flagged inCycle whenever both endpoints sit on *some* cycle, not
  // necessarily the same one (a cheap approximation of true per-cycle edge membership).
  for (const e of edges) e.inCycle = cyclic.has(e.source) && cyclic.has(e.target)

  return { root: rootPath, nodes, edges, truncated }
}
