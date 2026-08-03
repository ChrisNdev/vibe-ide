import http from 'http'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { getWorkspaceRoot } from './file-watcher'
import { TOOL_DEFS, callTool } from './mcp-tools'

/**
 * Minimal hand-rolled MCP server over HTTP (JSON-RPC 2.0, single-response mode —
 * no SSE/session state needed for these short-lived, synchronous tool calls).
 * No SDK dependency: the wire format for initialize/tools-list/tools-call is a
 * handful of message shapes, not worth pulling in a package for.
 *
 * Unlike hooks-server.ts, the port here is NOT ephemeral: .mcp.json is read once
 * by Claude Code at session start (not re-resolved per call the way the hook
 * script re-reads its endpoint file), so the URL written into .mcp.json at
 * install time has to keep working across app restarts. A fixed port is the
 * trade-off — stability over always grabbing a free one.
 */
const FIXED_PORT = 47821

let server: http.Server | null = null
let activePort: number | null = null
let activeToken: string | null = null

/**
 * .mcp.json bakes the Authorization header in statically, so — like the port —
 * the token has to survive app restarts. Persisted once, reused forever (until
 * uninstall), instead of regenerated per launch like the hooks server's token.
 */
function tokenFilePath(): string {
  return path.join(app.getPath('userData'), 'mcp-token.txt')
}

function loadOrCreateToken(): string {
  try {
    const existing = fs.readFileSync(tokenFilePath(), 'utf-8').trim()
    if (existing) return existing
  } catch {
    // no token yet
  }
  const fresh = crypto.randomBytes(24).toString('hex')
  fs.writeFileSync(tokenFilePath(), fresh, 'utf-8')
  return fresh
}

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

function rpcResult(id: JsonRpcRequest['id'], result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, result })
}

function rpcError(id: JsonRpcRequest['id'], code: number, message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })
}

async function handleRpc(req: JsonRpcRequest): Promise<string | null> {
  const { id, method, params } = req

  if (method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'vibeide', version: '1.0.0' }
    })
  }
  if (method === 'notifications/initialized' || method.startsWith('notifications/')) {
    return null // notifications have no id and expect no response
  }
  if (method === 'tools/list') {
    return rpcResult(id, { tools: TOOL_DEFS })
  }
  if (method === 'tools/call') {
    const toolName = params?.name
    if (typeof toolName !== 'string') return rpcError(id, -32602, 'Missing tool name')
    const result = await callTool(toolName, getWorkspaceRoot())
    return rpcResult(id, result)
  }
  if (method === 'ping') {
    return rpcResult(id, {})
  }
  return rpcError(id, -32601, `Method not found: ${method}`)
}

export function startMcpServer(): Promise<{ port: number; token: string }> {
  if (server && activePort && activeToken) return Promise.resolve({ port: activePort, token: activeToken })

  activeToken = loadOrCreateToken()

  server = http.createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end()
      return
    }
    if (req.headers.authorization !== `Bearer ${activeToken}`) {
      res.writeHead(401).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Unauthorized' } }))
      return
    }
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf-8')
      if (body.length > 5_000_000) req.destroy()
    })
    req.on('end', () => {
      void (async () => {
        try {
          const parsed = JSON.parse(body) as JsonRpcRequest
          const responseBody = await handleRpc(parsed)
          if (responseBody === null) {
            res.writeHead(202).end()
          } else {
            res.writeHead(200, { 'content-type': 'application/json' }).end(responseBody)
          }
        } catch {
          res.writeHead(400).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' } }))
        }
      })()
    })
  })

  const token = activeToken
  return new Promise((resolve) => {
    server!.on('error', () => {
      // most likely EADDRINUSE (another instance, or something else on this port) —
      // fail quiet, matching install/status flows that treat "no port" as unavailable
      activePort = null
      resolve({ port: 0, token })
    })
    server!.listen(FIXED_PORT, '127.0.0.1', () => {
      activePort = FIXED_PORT
      resolve({ port: FIXED_PORT, token })
    })
  })
}

export function getMcpEndpoint(): { port: number; token: string } | null {
  if (!activePort || !activeToken) return null
  return { port: activePort, token: activeToken }
}

export function stopMcpServer(): void {
  server?.close()
  server = null
  activePort = null
  activeToken = null
}
