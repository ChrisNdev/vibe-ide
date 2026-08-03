import fs from 'fs/promises'
import { buildProjectGraph } from './graph-builder'
import { getActiveFile } from './active-file-tracker'
import { consoleErrorLog } from './console-error-log'
import { runDiagnostics } from './diagnostics-runner'

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

export async function callTool(name: string, rootPath: string | null): Promise<ToolResult> {
  switch (name) {
    case 'get_project_graph': {
      if (!rootPath) return errorText('Nenhum projeto está aberto no vibeIDE.')
      const graph = await buildProjectGraph(rootPath)
      return text({ root: graph.root, fileCount: graph.nodes.length, edgeCount: graph.edges.length, truncated: graph.truncated, nodes: graph.nodes, edges: graph.edges })
    }
    case 'get_diagnostics': {
      if (!rootPath) return errorText('Nenhum projeto está aberto no vibeIDE.')
      return text(await runDiagnostics(rootPath))
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
