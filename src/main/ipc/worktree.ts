import { ipcMain } from 'electron'
import { IPC, WorktreeInfo, WorktreeResult } from '../../shared/types'
import { createWorktree, listWorktrees, removeWorktree, diffWorktreeAgainstBase, mergeWorktree, currentBranch } from '../worktree-manager'
import { statusFor } from '../agent-board'

export function registerWorktreeHandlers(): void {
  ipcMain.handle(IPC.WORKTREE_CREATE, async (_e, rootPath: string, taskName: string): Promise<WorktreeResult> => {
    return createWorktree(rootPath, taskName)
  })

  ipcMain.handle(IPC.WORKTREE_LIST, async (_e, rootPath: string): Promise<WorktreeInfo[]> => {
    return listWorktrees(rootPath, statusFor)
  })

  ipcMain.handle(IPC.WORKTREE_REMOVE, async (_e, rootPath: string, worktreePath: string): Promise<WorktreeResult> => {
    return removeWorktree(rootPath, worktreePath)
  })

  ipcMain.handle(IPC.WORKTREE_DIFF, async (_e, rootPath: string, branch: string): Promise<string> => {
    const base = await currentBranch(rootPath)
    return diffWorktreeAgainstBase(rootPath, branch, base)
  })

  ipcMain.handle(IPC.WORKTREE_MERGE, async (_e, rootPath: string, branch: string): Promise<WorktreeResult> => {
    return mergeWorktree(rootPath, branch)
  })
}
