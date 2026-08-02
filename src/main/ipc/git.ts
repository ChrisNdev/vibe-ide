import { ipcMain } from 'electron'
import { simpleGit } from 'simple-git'
import path from 'path'
import { IPC, GitRepoStatus, GitFileStatus, GitStatusMap } from '../../shared/types'

export function registerGitHandlers(): void {
  ipcMain.handle(IPC.GIT_STATUS, async (_e, rootPath: string): Promise<GitRepoStatus> => {
    const git = simpleGit(rootPath)
    const isRepo = await git.checkIsRepo().catch(() => false)
    if (!isRepo) {
      return { isRepo: false, branch: null, files: {}, ahead: 0, behind: 0 }
    }

    try {
      const status = await git.status()
      const files: GitStatusMap = {}

      const setStatus = (paths: string[], s: GitFileStatus): void => {
        for (const p of paths) {
          const abs = path.join(rootPath, p)
          files[abs] = s
        }
      }

      setStatus(status.not_added, 'untracked')
      setStatus(status.created, 'added')
      setStatus(status.deleted, 'deleted')
      setStatus(status.modified, 'modified')
      setStatus(status.renamed.map((r) => r.to), 'renamed')
      setStatus(status.conflicted, 'conflicted')
      setStatus(status.staged, 'staged')

      return {
        isRepo: true,
        branch: status.current,
        files,
        ahead: status.ahead,
        behind: status.behind
      }
    } catch {
      return { isRepo: true, branch: null, files: {}, ahead: 0, behind: 0 }
    }
  })

  ipcMain.handle(IPC.GIT_DIFF, async (_e, rootPath: string, filePath: string): Promise<string> => {
    const git = simpleGit(rootPath)
    const rel = path.relative(rootPath, filePath)
    try {
      // diffs against HEAD so both staged and unstaged edits show up in one view
      return await git.diff(['HEAD', '--', rel])
    } catch {
      return ''
    }
  })
}
