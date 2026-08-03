import { ipcMain } from 'electron'
import { IPC, CheckpointMeta, GitRepoCheckResult, CheckpointRestoreResult } from '../../shared/types'
import { isGitRepo, hasSubmodules, listCheckpoints, diffCheckpoint, restoreCheckpoint } from '../checkpoint-manager'

export function registerCheckpointsHandlers(): void {
  ipcMain.handle(IPC.CHECKPOINTS_CHECK_REPO, async (_e, rootPath: string): Promise<GitRepoCheckResult> => {
    return { isGitRepo: await isGitRepo(rootPath), hasSubmodules: hasSubmodules(rootPath) }
  })

  ipcMain.handle(IPC.CHECKPOINTS_LIST, async (_e, rootPath: string): Promise<CheckpointMeta[]> => {
    return listCheckpoints(rootPath)
  })

  ipcMain.handle(IPC.CHECKPOINTS_DIFF, async (_e, rootPath: string, commit: string): Promise<string> => {
    return diffCheckpoint(rootPath, commit)
  })

  ipcMain.handle(IPC.CHECKPOINTS_RESTORE, async (_e, rootPath: string, commit: string): Promise<CheckpointRestoreResult> => {
    return restoreCheckpoint(rootPath, commit)
  })
}
