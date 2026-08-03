import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import fsSync from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { app } from 'electron'
import { CheckpointMeta, CheckpointRestoreResult } from '../shared/types'

const execFileAsync = promisify(execFile)

const MAX_CHECKPOINT_MB = 200
const MAX_CHECKPOINTS = 100
const GIT_BUFFER = { maxBuffer: 64 * 1024 * 1024 }

/** Same encoding as transcript-tailer.ts's project dir — not shared on purpose, keeps each module self-contained. */
function encodeProjectDir(rootPath: string): string {
  return rootPath.replace(/[^a-zA-Z0-9]/g, '-')
}

function metaFilePath(rootPath: string): string {
  return path.join(app.getPath('userData'), 'checkpoints', `${encodeProjectDir(rootPath)}.json`)
}

async function readMeta(rootPath: string): Promise<CheckpointMeta[]> {
  try {
    const raw = await fs.readFile(metaFilePath(rootPath), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeMeta(rootPath: string, meta: CheckpointMeta[]): Promise<void> {
  const file = metaFilePath(rootPath)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(meta, null, 2), 'utf-8')
}

async function git(rootPath: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: rootPath, env: env ?? process.env, ...GIT_BUFFER })
  return stdout
}

export async function isGitRepo(rootPath: string): Promise<boolean> {
  try {
    const out = await git(rootPath, ['rev-parse', '--is-inside-work-tree'])
    return out.trim() === 'true'
  } catch {
    return false
  }
}

export function hasSubmodules(rootPath: string): boolean {
  return fsSync.existsSync(path.join(rootPath, '.gitmodules'))
}

async function objectExists(rootPath: string, sha: string): Promise<boolean> {
  try {
    await git(rootPath, ['cat-file', '-e', sha])
    return true
  } catch {
    return false
  }
}

async function currentHead(rootPath: string): Promise<string | null> {
  try {
    return (await git(rootPath, ['rev-parse', 'HEAD'])).trim()
  } catch {
    return null // unborn HEAD — brand new repo with no commits yet
  }
}

interface CreateResult {
  meta: CheckpointMeta | null
  skippedReason: 'too-large' | 'not-a-repo' | 'nothing-to-snapshot' | null
}

/**
 * Rapid-fire PreToolUse events (an agent making several edits in a row) can call
 * createCheckpoint() before the previous call has finished reading/writing
 * meta.json and allocating the next ref name — without serializing, concurrent
 * calls read the same stale meta.length and stomp each other's ref, silently
 * losing checkpoints. One queue per project root keeps creation strictly sequential.
 */
const creationQueues = new Map<string, Promise<unknown>>()

async function withCheckpointQueue<T>(rootPath: string, fn: () => Promise<T>): Promise<T> {
  const previous = creationQueues.get(rootPath) ?? Promise.resolve()
  const run = previous.then(fn, fn)
  creationQueues.set(
    rootPath,
    run.catch(() => {})
  )
  return run
}

/**
 * Snapshot the current working tree into its own commit + ref, entirely through
 * a temporary index (GIT_INDEX_FILE) — the real .git/index, HEAD, stash, and
 * working tree are never touched. If the tree turns out too large, the commit
 * is simply never created (no ref, so it's just an unreferenced object git
 * will reap on its own gc cycle — nothing to explicitly undo).
 */
export async function createCheckpoint(rootPath: string, toolName: string, label: string): Promise<CreateResult> {
  return withCheckpointQueue(rootPath, () => createCheckpointUnqueued(rootPath, toolName, label))
}

async function createCheckpointUnqueued(rootPath: string, toolName: string, label: string): Promise<CreateResult> {
  if (!(await isGitRepo(rootPath))) return { meta: null, skippedReason: 'not-a-repo' }

  const tempIndex = path.join(os.tmpdir(), `vibeide-checkpoint-${crypto.randomBytes(8).toString('hex')}.index`)
  const env = { ...process.env, GIT_INDEX_FILE: tempIndex }

  try {
    await git(rootPath, ['add', '-A'], env)
    const treeSha = (await git(rootPath, ['write-tree'], env)).trim()

    const lsTree = await git(rootPath, ['ls-tree', '-r', '-l', treeSha])
    let totalBytes = 0
    for (const line of lsTree.split('\n')) {
      const match = line.match(/^\S+ \S+ \S+ +(\d+)\t/)
      if (match) totalBytes += Number(match[1])
    }
    if (totalBytes > MAX_CHECKPOINT_MB * 1024 * 1024) {
      return { meta: null, skippedReason: 'too-large' }
    }

    const meta = await readMeta(rootPath)
    // The last checkpoint's commit is normally still reachable, but if the repo was
    // rewritten/pruned/recreated behind the app's back, a stale sidecar entry pointing
    // at a now-missing object would otherwise break every checkpoint from then on —
    // verify it first and fall back to HEAD (or a rootless commit) instead of cascading.
    let parent = meta.length > 0 ? meta[meta.length - 1].commit : await currentHead(rootPath)
    if (parent && !(await objectExists(rootPath, parent))) {
      parent = await currentHead(rootPath)
    }
    const commitArgs = ['commit-tree', treeSha, '-m', label]
    if (parent) commitArgs.push('-p', parent)
    const commitSha = (await git(rootPath, commitArgs)).trim()

    const ref = `refs/vibe/checkpoints/${meta.length}`
    await git(rootPath, ['update-ref', ref, commitSha])

    const entry: CheckpointMeta = {
      ref,
      commit: commitSha,
      label,
      timestamp: new Date().toISOString(),
      sizeBytes: totalBytes,
      toolName
    }
    meta.push(entry)
    await writeMeta(rootPath, meta)
    await pruneCheckpoints(rootPath, meta)

    return { meta: entry, skippedReason: null }
  } catch {
    return { meta: null, skippedReason: null }
  } finally {
    await fs.unlink(tempIndex).catch(() => {})
  }
}

async function pruneCheckpoints(rootPath: string, meta: CheckpointMeta[]): Promise<void> {
  if (meta.length <= MAX_CHECKPOINTS) return
  const overflow = meta.length - MAX_CHECKPOINTS
  const toRemove = meta.splice(0, overflow)
  for (const entry of toRemove) {
    await git(rootPath, ['update-ref', '-d', entry.ref]).catch(() => {})
  }
  await writeMeta(rootPath, meta)
  await git(rootPath, ['gc', '--auto', '--quiet']).catch(() => {})
}

export async function listCheckpoints(rootPath: string): Promise<CheckpointMeta[]> {
  const meta = await readMeta(rootPath)
  return [...meta].reverse()
}

export async function diffCheckpoint(rootPath: string, commit: string): Promise<string> {
  try {
    return await git(rootPath, ['diff', commit])
  } catch {
    return ''
  }
}

interface NameStatusEntry {
  status: string
  path: string
}

async function nameStatusAgainstWorkingTree(rootPath: string, commit: string): Promise<NameStatusEntry[]> {
  const raw = await git(rootPath, ['diff', '--name-status', '-z', commit])
  const parts = raw.split('\0').filter(Boolean)
  const entries: NameStatusEntry[] = []
  for (let i = 0; i < parts.length; i += 2) {
    const status = parts[i]
    const filePath = parts[i + 1]
    if (status && filePath) entries.push({ status: status[0], path: filePath })
  }
  return entries
}

/**
 * Writes files directly (via `git show <commit>:<path>` + fs.writeFile) rather than
 * `git checkout`, so the real index is never touched even during an explicit restore.
 * Always snapshots the current state first — restoring needs a way back too.
 */
export async function restoreCheckpoint(rootPath: string, commit: string): Promise<CheckpointRestoreResult> {
  if (!(await isGitRepo(rootPath))) return { ok: false, filesChanged: [], error: 'Não é um repositório git.' }

  await createCheckpoint(rootPath, 'restore', `Antes de restaurar ${commit.slice(0, 8)}`)

  try {
    const entries = await nameStatusAgainstWorkingTree(rootPath, commit)
    const filesChanged: string[] = []

    for (const entry of entries) {
      const absPath = path.join(rootPath, entry.path)
      if (entry.status === 'A') {
        await fs.unlink(absPath).catch(() => {})
      } else {
        const { stdout } = await execFileAsync('git', ['show', `${commit}:${entry.path}`], {
          cwd: rootPath,
          encoding: 'buffer',
          maxBuffer: GIT_BUFFER.maxBuffer
        })
        await fs.mkdir(path.dirname(absPath), { recursive: true })
        await fs.writeFile(absPath, stdout)
      }
      filesChanged.push(entry.path)
    }

    return { ok: true, filesChanged }
  } catch (err) {
    return { ok: false, filesChanged: [], error: err instanceof Error ? err.message : String(err) }
  }
}
