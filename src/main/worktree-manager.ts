import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { WorktreeInfo, WorktreeResult } from '../shared/types'

const execFileAsync = promisify(execFile)
const GIT_BUFFER = { maxBuffer: 32 * 1024 * 1024 }

async function git(rootPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd: rootPath, ...GIT_BUFFER })
  return stdout
}

/** Sibling of the project root, per docs/PLANO.md — not inside it, so it's never accidentally committed or watched. */
export function worktreesDir(rootPath: string): string {
  return path.join(path.dirname(rootPath), '.vibe-worktrees')
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || `tarefa-${Date.now()}`
}

export async function createWorktree(rootPath: string, taskName: string): Promise<WorktreeResult> {
  try {
    let branch = slugify(taskName)

    // Branch names must be unique — if it already exists (same task name reused), suffix it rather than fail.
    const existingBranches = await git(rootPath, ['branch', '--list', branch])
    if (existingBranches.trim()) {
      branch = `${branch}-${Date.now().toString(36)}`
    }

    const finalTarget = path.join(worktreesDir(rootPath), branch)
    await git(rootPath, ['worktree', 'add', finalTarget, '-b', branch])
    return { ok: true, path: finalTarget }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

interface RawWorktree {
  path: string
  branch: string | null
}

async function listAllWorktrees(rootPath: string): Promise<RawWorktree[]> {
  const raw = await git(rootPath, ['worktree', 'list', '--porcelain'])
  const entries: RawWorktree[] = []
  let current: Partial<RawWorktree> = {}
  for (const line of raw.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) entries.push({ path: current.path, branch: current.branch ?? null })
      current = { path: line.slice('worktree '.length).trim() }
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace('refs/heads/', '').trim()
    }
  }
  if (current.path) entries.push({ path: current.path, branch: current.branch ?? null })
  return entries
}

export async function listWorktrees(rootPath: string, statusOf: (worktreePath: string) => WorktreeInfo['status']): Promise<WorktreeInfo[]> {
  try {
    const all = await listAllWorktrees(rootPath)
    const dir = path.resolve(worktreesDir(rootPath))
    return all
      .filter((w) => path.resolve(w.path).startsWith(dir) && w.branch)
      .map((w) => ({ path: w.path, branch: w.branch as string, createdAt: '', status: statusOf(w.path) }))
  } catch {
    return []
  }
}

export async function removeWorktree(rootPath: string, worktreePath: string): Promise<WorktreeResult> {
  try {
    // Confirmation already happened in the UI — "nunca automático" means the app never
    // does this on its own, not that this call itself needs another gate.
    await git(rootPath, ['worktree', 'remove', worktreePath, '--force'])
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function diffWorktreeAgainstBase(rootPath: string, branch: string, baseBranch: string): Promise<string> {
  try {
    return await git(rootPath, ['diff', `${baseBranch}...${branch}`])
  } catch {
    return ''
  }
}

export async function mergeWorktree(rootPath: string, branch: string): Promise<WorktreeResult> {
  try {
    await git(rootPath, ['merge', branch])
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function currentBranch(rootPath: string): Promise<string> {
  try {
    return (await git(rootPath, ['branch', '--show-current'])).trim() || 'HEAD'
  } catch {
    return 'HEAD'
  }
}
