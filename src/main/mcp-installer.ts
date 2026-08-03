import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import type { McpInstallResult } from '../shared/types'
import { startMcpServer, getMcpEndpoint } from './mcp-server'

const SERVER_NAME = 'vibeide'

function mcpJsonPath(rootPath: string): string {
  return path.join(rootPath, '.mcp.json')
}
function markerPath(rootPath: string): string {
  return path.join(rootPath, '.claude', '.vibeide-mcp-installed')
}

async function readJsonIfExists(p: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf-8'))
  } catch {
    return null
  }
}

export function mcpInstalled(rootPath: string): boolean {
  return fsSync.existsSync(markerPath(rootPath))
}

export async function installMcp(rootPath: string): Promise<McpInstallResult> {
  try {
    let endpoint = getMcpEndpoint()
    if (!endpoint || !endpoint.port) {
      endpoint = await startMcpServer()
    }
    if (!endpoint.port) {
      return { ok: false, error: `Não consegui abrir a porta do servidor MCP (127.0.0.1:${endpoint.token ? '47821' : '?'} pode estar em uso).` }
    }

    const jsonPath = mcpJsonPath(rootPath)
    const existed = fsSync.existsSync(jsonPath)

    const current = (await readJsonIfExists(jsonPath)) ?? {}
    const servers = (current.mcpServers as Record<string, unknown>) ?? {}
    current.mcpServers = servers
    servers[SERVER_NAME] = {
      type: 'http',
      url: `http://127.0.0.1:${endpoint.port}/mcp`,
      headers: { Authorization: `Bearer ${endpoint.token}` }
    }

    await fs.writeFile(jsonPath, JSON.stringify(current, null, 2), 'utf-8')
    await fs.mkdir(path.dirname(markerPath(rootPath)), { recursive: true })
    await fs.writeFile(markerPath(rootPath), existed ? 'existed' : 'created', 'utf-8')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Removes only the "vibeide" entry — other MCP servers in .mcp.json are left exactly as they were. */
export async function uninstallMcp(rootPath: string): Promise<McpInstallResult> {
  try {
    const jsonPath = mcpJsonPath(rootPath)
    const current = await readJsonIfExists(jsonPath)
    if (current && current.mcpServers && typeof current.mcpServers === 'object') {
      const servers = current.mcpServers as Record<string, unknown>
      delete servers[SERVER_NAME]
      if (Object.keys(servers).length === 0) {
        delete current.mcpServers
      }
      if (Object.keys(current).length === 0) {
        await fs.unlink(jsonPath).catch(() => {})
      } else {
        await fs.writeFile(jsonPath, JSON.stringify(current, null, 2), 'utf-8')
      }
    }
    await fs.unlink(markerPath(rootPath)).catch(() => {})
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
