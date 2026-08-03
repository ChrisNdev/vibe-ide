import http from 'http'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { EventEmitter } from 'events'
import type { HookEvent } from '../shared/types'

/**
 * Local HTTP server the installed hook script POSTs to. Ephemeral port + random
 * per-launch token, bound to 127.0.0.1 only — matches INVARIANTES: local server,
 * token-gated, reject anything without it.
 */
export const hookEvents = new EventEmitter()

let server: http.Server | null = null

function endpointFilePath(): string {
  return path.join(app.getPath('userData'), 'hooks-endpoint.json')
}

const MAX_BODY_BYTES = 1_000_000

export function startHooksServer(): void {
  if (server) return
  const token = crypto.randomBytes(24).toString('hex')

  server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/hook') {
      res.writeHead(404).end()
      return
    }
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.writeHead(401).end()
      return
    }
    let body = ''
    let tooLarge = false
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf-8')
      if (body.length > MAX_BODY_BYTES) {
        tooLarge = true
        req.destroy()
      }
    })
    req.on('end', () => {
      if (tooLarge) return
      try {
        const payload = JSON.parse(body) as HookEvent
        if (typeof payload.hook_event_name === 'string') hookEvents.emit('event', payload)
      } catch {
        // malformed payload — ignore, never let a bad hook body affect the app
      }
      res.writeHead(200).end()
    })
  })

  server.listen(0, '127.0.0.1', () => {
    const addr = server?.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    fs.writeFileSync(endpointFilePath(), JSON.stringify({ port, token }), 'utf-8')
  })
}

export function stopHooksServer(): void {
  server?.close()
  server = null
  try {
    fs.unlinkSync(endpointFilePath())
  } catch {
    // already gone
  }
}
