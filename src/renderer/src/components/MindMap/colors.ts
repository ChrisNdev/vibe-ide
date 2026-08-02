export function colorForDir(dir: string): string {
  const top = dir === '.' ? 'root' : dir.split('/')[0] || 'root'
  let hash = 0
  for (let i = 0; i < top.length; i++) hash = (hash * 31 + top.charCodeAt(i)) >>> 0
  const hue = hash % 360
  return `hsl(${hue}, 58%, 64%)`
}
