/** Mirrors the renderer's Preview pane selection so the MCP server's get_open_file tool can read it without an IPC round-trip per call. */
let activeFile: { path: string; line: number | null } | null = null

export function setActiveFile(path: string | null, line: number | null): void {
  activeFile = path ? { path, line } : null
}

export function getActiveFile(): { path: string; line: number | null } | null {
  return activeFile
}
