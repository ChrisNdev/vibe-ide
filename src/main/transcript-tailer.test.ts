import assert from 'assert'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import { watchSession, unwatchSession } from './transcript-tailer'
import type { TranscriptState } from '../shared/types'

/**
 * Covers the incremental reader, which is the only branchy part of this module: it has to
 * survive a line arriving in two writes, never count the same tool call twice, and pick the
 * file back up after a rewrite. Run with `npm test`.
 *
 * Drives the real watchSession(), so it needs the same layout the tailer looks for:
 * ~/.claude/projects/<encoded-root>/<session>.jsonl. HOME/USERPROFILE are pointed at a temp
 * dir first so nothing touches the real transcripts.
 */

function toolUseLine(id: string, file: string): string {
  return JSON.stringify({
    type: 'assistant',
    uuid: `uuid-${id}`,
    timestamp: '2026-01-01T00:00:00.000Z',
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', id, name: 'Edit', input: { file_path: file } }],
      usage: { input_tokens: 10, output_tokens: 5 }
    }
  })
}

/** chokidar's watcher is debounced by the OS; poll the reported state instead of guessing a delay. */
function waitFor(read: () => TranscriptState | null, predicate: (s: TranscriptState) => boolean): Promise<TranscriptState> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 8000
    const tick = (): void => {
      const state = read()
      if (state && predicate(state)) return resolve(state)
      if (Date.now() > deadline) return reject(new Error(`timed out; last state: ${JSON.stringify(state)}`))
      setTimeout(tick, 50)
    }
    tick()
  })
}

async function main(): Promise<void> {
  const home = await fsp.mkdtemp(path.join(os.tmpdir(), 'vibeide-tailer-test-'))
  process.env.HOME = home
  process.env.USERPROFILE = home

  const projectRoot = path.join(home, 'proj')
  await fsp.mkdir(projectRoot)
  const transcriptDir = path.join(home, '.claude', 'projects', projectRoot.replace(/[^a-zA-Z0-9]/g, '-'))
  await fsp.mkdir(transcriptDir, { recursive: true })
  const transcript = path.join(transcriptDir, 'session-1.jsonl')

  await fsp.writeFile(transcript, toolUseLine('t1', 'a.ts') + '\n', 'utf-8')

  let latest: TranscriptState | null = null
  const started = await watchSession(1, projectRoot, (state) => {
    latest = state
  })
  assert.strictEqual(started.ok, true, 'watchSession should find the session file')
  await waitFor(() => latest, (s) => s.toolCalls.length === 1)

  // A line split across two appends: the fragment must not be parsed (and counted as failed)
  // on the first pass, and must be ingested exactly once when the newline finally lands.
  const second = toolUseLine('t2', 'b.ts')
  fs.appendFileSync(transcript, second.slice(0, 40))
  await new Promise((r) => setTimeout(r, 300))
  assert.strictEqual(latest!.toolCalls.length, 1, 'a half-written line must not produce a tool call')
  assert.strictEqual(latest!.failedLines, 0, 'a half-written line must not count as a parse failure')

  fs.appendFileSync(transcript, second.slice(40) + '\n')
  const after = await waitFor(() => latest, (s) => s.toolCalls.length === 2)
  assert.strictEqual(after.failedLines, 0, 'the completed line must parse cleanly')
  assert.deepStrictEqual(
    after.toolCalls.map((c) => c.id),
    ['t1', 't2'],
    'each line ingested exactly once, in order'
  )
  assert.strictEqual(after.usage.length, 2, 'usage points must not be double-counted either')

  // Rewrite shorter than the current offset — the reader has to reset instead of parking past EOF.
  await fsp.writeFile(transcript, toolUseLine('t3', 'c.ts') + '\n', 'utf-8')
  const rotated = await waitFor(() => latest, (s) => s.toolCalls.some((c) => c.id === 't3'))
  assert.ok(rotated.toolCalls.some((c) => c.id === 't3'), 'updates must resume after the file shrinks')

  unwatchSession(1)
  await fsp.rm(home, { recursive: true, force: true }).catch(() => {})
  console.log('transcript-tailer: ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
