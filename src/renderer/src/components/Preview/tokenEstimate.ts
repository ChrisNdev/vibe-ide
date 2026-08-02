/** Rough chars/4 heuristic (the common rule of thumb for English/code text) — just enough to tell someone "this costs ~Nk tokens if you paste it into the chat". */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.round(text.length / 4))
}

export function formatTokens(n: number): string {
  if (n < 1000) return `~${n} tokens`
  return `~${(n / 1000).toFixed(1)}k tokens`
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
