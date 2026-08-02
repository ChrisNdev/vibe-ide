import fs from 'fs/promises'
import path from 'path'
import { GraphNode, GraphEdge, ProjectGraph } from '../shared/types'

/**
 * Builds a "mind map" of a project's internal file relationships purely via
 * local filesystem reads + regex import parsing — no LLM/AI calls involved,
 * so visualizing the project structure never costs API tokens.
 */

const JS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.vue'])
const PY_EXTENSIONS = new Set(['.py'])
const CODE_EXTENSIONS = new Set([...JS_EXTENSIONS, ...PY_EXTENSIONS])

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  'coverage',
  '.vscode',
  '.idea',
  'venv',
  '.venv',
  '__pycache__',
  '.pytest_cache'
])

const MAX_FILES = 2500
const MAX_FILE_SIZE = 512 * 1024
/** caps concurrent fs operations so a huge repo can't blow past the OS file-handle limit (or just thrash the disk) */
const FS_CONCURRENCY = 64

const JS_IMPORT_RE =
  /(?:\bimport\s+(?:[\s\S]*?\sfrom\s+)?|\bexport\s+(?:[\s\S]*?\sfrom\s+)?|\brequire\(\s*|\bimport\(\s*)['"]([^'"]+)['"]/g

const PY_IMPORT_RE = /^\s*from\s+(\.+[\w.]*)\s+import|^\s*import\s+([\w.]+)/gm

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
async function collectFiles(dir: string, files: string[], limit: <T>(fn: () => Promise<T>) => Promise<T>): Promise<void> {
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
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue
      subdirs.push(full)
    } else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full)
    }
  }
  await Promise.all(subdirs.map((sub) => collectFiles(sub, files, limit)))
}

/** Pure path resolution — no I/O, so it stays synchronous instead of paying Promise overhead per import. */
function resolveJsImport(fromFile: string, spec: string, known: Set<string>): string | null {
  if (!spec.startsWith('.')) return null // external package — not part of the project mind map
  const base = path.resolve(path.dirname(fromFile), spec)
  const candidates = [
    base,
    ...[...JS_EXTENSIONS].map((ext) => base + ext),
    ...[...JS_EXTENSIONS].map((ext) => path.join(base, 'index' + ext))
  ]
  for (const candidate of candidates) {
    if (known.has(candidate)) return candidate
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

export async function buildProjectGraph(rootPath: string): Promise<ProjectGraph> {
  const limit = createLimiter(FS_CONCURRENCY)
  const files: string[] = []
  await collectFiles(rootPath, files, limit)
  const truncated = files.length >= MAX_FILES
  const known = new Set(files)

  const nodes: GraphNode[] = files.map((full) => {
    const rel = toPosix(path.relative(rootPath, full))
    return {
      id: rel,
      label: path.basename(full),
      dir: toPosix(path.dirname(rel)),
      ext: path.extname(full),
      size: 0
    }
  })
  const nodeById = new Map(nodes.map((n) => [n.id, n]))

  const edgeSet = new Set<string>()
  const edges: GraphEdge[] = []

  const addEdge = (sourceId: string, targetId: string): void => {
    const key = `${sourceId}->${targetId}`
    if (sourceId !== targetId && !edgeSet.has(key)) {
      edgeSet.add(key)
      edges.push({ source: sourceId, target: targetId })
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
        if (node) node.size = stat.size
        if (stat.size > MAX_FILE_SIZE) return
        let content: string
        try {
          content = await fs.readFile(full, 'utf-8')
        } catch {
          return
        }

        const ext = path.extname(full)

        if (JS_EXTENSIONS.has(ext)) {
          for (const match of content.matchAll(JS_IMPORT_RE)) {
            const resolved = resolveJsImport(full, match[1], known)
            if (resolved) addEdge(sourceId, toPosix(path.relative(rootPath, resolved)))
          }
        } else if (PY_EXTENSIONS.has(ext)) {
          for (const match of content.matchAll(PY_IMPORT_RE)) {
            const module = match[1] ?? match[2]
            const resolved = resolvePyImport(full, rootPath, module, known)
            if (resolved) addEdge(sourceId, toPosix(path.relative(rootPath, resolved)))
          }
        }
      })
    )
  )

  return { root: rootPath, nodes, edges, truncated }
}
