export interface DiffLine {
  type: 'add' | 'remove' | 'hunk' | 'meta' | 'context'
  text: string
}

export function parseDiff(diffText: string): DiffLine[] {
  return diffText.split('\n').map((line) => {
    if (line.startsWith('@@')) return { type: 'hunk', text: line }
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) {
      return { type: 'meta', text: line }
    }
    if (line.startsWith('+')) return { type: 'add', text: line }
    if (line.startsWith('-')) return { type: 'remove', text: line }
    return { type: 'context', text: line }
  })
}
