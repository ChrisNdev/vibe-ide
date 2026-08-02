import Prism from 'prismjs'
// order matters: each of these registers itself against languages the later ones extend
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-markdown'

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  json: 'json',
  css: 'css',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  vue: 'markup',
  md: 'markdown',
  mdx: 'markdown',
  py: 'python',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash'
}

export function languageForFile(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_LANG[ext] ?? null
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Highlights the whole file at once (not line-by-line) so multi-line tokens like block comments stay correct. */
export function highlight(code: string, lang: string | null): string {
  const grammar = lang ? Prism.languages[lang] : undefined
  if (!grammar) return escapeHtml(code)
  try {
    return Prism.highlight(code, grammar, lang!)
  } catch {
    return escapeHtml(code)
  }
}
