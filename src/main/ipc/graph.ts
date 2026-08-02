import { ipcMain } from 'electron'
import { IPC, ProjectGraph } from '../../shared/types'
import { buildProjectGraph } from '../graph-builder'

export function registerGraphHandlers(): void {
  ipcMain.handle(IPC.GRAPH_BUILD, async (_e, rootPath: string): Promise<ProjectGraph> => {
    return buildProjectGraph(rootPath)
  })
}
