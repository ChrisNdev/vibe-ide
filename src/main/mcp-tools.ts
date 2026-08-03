import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { buildProjectGraph } from './graph-builder'
import { getActiveFile } from './active-file-tracker'
import { consoleErrorLog } from './console-error-log'

const execFileAsync = promisify(execFile)

export interface ToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

function text(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] }
}

function errorText(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

export const TOOL_DEFS = [
  {
    name: 'get_project_graph',
    description:
      'Returns the project\'s internal import graph (files, sizes, edges) already computed by vibeIDE — use this instead of grepping for imports across the codebase.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_diagnostics',
    description: 'Runs tsc --noEmit (and eslint, if configured) in the open project and returns structured errors/warnings.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_open_file',
    description: "Returns the file path and line currently open in vibeIDE's preview pane, if any.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_console_errors',
    description: 'Returns recent console errors and failed network requests captured from the dev server preview (Fase 8).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  }
] as const

function parseTscOutput(output: string): { file: string; line: number; column: number; message: string }[] {
  const issues: { file: string; line: number; column: number; message: string }[] = []
  const re = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+: .+)$/
  for (const rawLine of output.split(/\r?\n/)) {
    const m = rawLine.match(re)
    if (m) issues.push({ file: m[1], line: Number(m[2]), column: Number(m[3]), message: m[5] })
  }
  return issues
}

async function runTsc(rootPath: string): Promise<{ available: boolean; issues: ReturnType<typeof parseTscOutput> }> {
  const tscBin = path.join(rootPath, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
  const hasTsconfig = fsSync.existsSync(path.join(rootPath, 'tsconfig.json'))
  const hasLocalTsc = fsSync.existsSync(tscBin)
  if (!hasTsconfig || !hasLocalTsc) return { available: false, issues: [] }
  try {
    const { stdout } = await execFileAsync(tscBin, ['--noEmit', '--pretty', 'false'], { cwd: rootPath, maxBuffer: 16 * 1024 * 1024 })
    return { available: true, issues: parseTscOutput(stdout) }
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout ?? ''
    return { available: true, issues: parseTscOutput(stdout) }
  }
}

async function runEslint(rootPath: string): Promise<{ available: boolean; issues: unknown[] }> {
  const eslintBin = path.join(rootPath, 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.cmd' : 'eslint')
  const hasConfig = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.cjs', 'eslint.config.js', 'eslint.config.mjs'].some((f) =>
    fsSync.existsSync(path.join(rootPath, f))
  )
  if (!hasConfig || !fsSync.existsSync(eslintBin)) return { available: false, issues: [] }
  try {
    const { stdout } = await execFileAsync(eslintBin, ['.', '--format', 'json'], { cwd: rootPath, maxBuffer: 16 * 1024 * 1024 })
    return { available: true, issues: JSON.parse(stdout) }
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout
    try {
      return { available: true, issues: stdout ? JSON.parse(stdout) : [] }
    } catch {
      return { available: true, issues: [] }
    }
  }
}

export async function callTool(name: string, rootPath: string | null): Promise<ToolResult> {
  switch (name) {
    case 'get_project_graph': {
      if (!rootPath) return errorText('Nenhum projeto está aberto no vibeIDE.')
      const graph = await buildProjectGraph(rootPath)
      return text({ root: graph.root, fileCount: graph.nodes.length, edgeCount: graph.edges.length, truncated: graph.truncated, nodes: graph.nodes, edges: graph.edges })
    }
    case 'get_diagnostics': {
      if (!rootPath) return errorText('Nenhum projeto está aberto no vibeIDE.')
      const [tsc, eslint] = await Promise.all([runTsc(rootPath), runEslint(rootPath)])
      return text({ typescript: tsc, eslint })
    }
    case 'get_open_file': {
      const active = getActiveFile()
      if (!active) return text({ open: false })
      let preview = ''
      try {
        preview = (await fs.readFile(active.path, 'utf-8')).slice(0, 4000)
      } catch {
        // file may have been deleted/moved since last selection — still report the path
      }
      return text({ open: true, path: active.path, line: active.line, preview })
    }
    case 'get_console_errors': {
      return text({ entries: consoleErrorLog.get() })
    }
    default:
      return errorText(`Ferramenta desconhecida: ${name}`)
  }
}
