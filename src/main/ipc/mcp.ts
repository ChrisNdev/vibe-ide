import { ipcMain } from 'electron'
import { IPC, McpInstallResult, McpStatus } from '../../shared/types'
import { installMcp, uninstallMcp, mcpInstalled } from '../mcp-installer'
import { getMcpEndpoint } from '../mcp-server'
import { setActiveFile } from '../active-file-tracker'

export function registerMcpHandlers(): void {
  ipcMain.handle(IPC.MCP_INSTALL, async (_e, rootPath: string): Promise<McpInstallResult> => {
    return installMcp(rootPath)
  })

  ipcMain.handle(IPC.MCP_UNINSTALL, async (_e, rootPath: string): Promise<McpInstallResult> => {
    return uninstallMcp(rootPath)
  })

  ipcMain.handle(IPC.MCP_STATUS, async (_e, rootPath: string): Promise<McpStatus> => {
    return { installed: mcpInstalled(rootPath), port: getMcpEndpoint()?.port ?? null }
  })

  ipcMain.handle(IPC.ACTIVE_FILE_SET, async (_e, filePath: string | null, line: number | null) => {
    setActiveFile(filePath, line)
  })
}
