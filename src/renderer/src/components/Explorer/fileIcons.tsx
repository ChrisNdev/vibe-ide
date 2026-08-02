import {
  FileCode2,
  FileJson,
  FileText,
  FileType,
  FileCog,
  Image,
  File as FileIcon,
  type LucideIcon
} from 'lucide-react'
import { extname } from './pathUtils'

const CODE_EXT = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'py', 'go', 'rs', 'c', 'cpp', 'h', 'java', 'rb', 'php', 'sh'])
const CONFIG_EXT = new Set(['json', 'yml', 'yaml', 'toml', 'ini', 'env'])
const DOC_EXT = new Set(['md', 'mdx', 'txt'])
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'])
const TYPE_EXT = new Set(['css', 'scss', 'less', 'html'])

export function iconForFile(name: string): LucideIcon {
  const ext = extname(name)
  if (ext === 'json') return FileJson
  if (CONFIG_EXT.has(ext)) return FileCog
  if (CODE_EXT.has(ext)) return FileCode2
  if (DOC_EXT.has(ext)) return FileText
  if (IMAGE_EXT.has(ext)) return Image
  if (TYPE_EXT.has(ext)) return FileType
  return FileIcon
}
