import fs from 'fs'
import path from 'path'

/** Always ignored regardless of .gitignore — these blow up memory/CPU on any repo, gitignored or not. */
const ALWAYS_IGNORE = new Set(['node_modules', '.git', '.hg', '.svn'])

/**
 * ponytail: only the root .gitignore is read (no nested .gitignore, no `!` negation, no
 * extends-style includes) — covers the common case cheaply. Upgrade path: swap for the
 * `ignore` npm package if a repo's ignore patterns turn out more exotic than this handles.
 */
function globToRegex(pattern: string): RegExp {
  const anchored = pattern.startsWith('/')
  const body = anchored ? pattern.slice(1) : pattern
  let re = '^'
  if (!anchored) re += '(?:.*/)?'
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '*' && body[i + 1] === '*') {
      re += '.*'
      i++
      if (body[i + 1] === '/') i++
    } else if (c === '*') {
      re += '[^/]*'
    } else if (c === '?') {
      re += '[^/]'
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c
    } else {
      re += c
    }
  }
  re += '(?:/.*)?$'
  return new RegExp(re)
}

/** Returns a matcher for POSIX-relative paths (no leading slash) against rootPath's .gitignore, plus hard-coded VCS/dependency dirs. */
export function createIgnoreMatcher(rootPath: string): (relPosixPath: string) => boolean {
  const rules: RegExp[] = []
  try {
    const content = fs.readFileSync(path.join(rootPath, '.gitignore'), 'utf-8')
    for (const raw of content.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#') || line.startsWith('!')) continue
      rules.push(globToRegex(line.replace(/\/$/, '')))
    }
  } catch {
    // no .gitignore at the root — fall back to ALWAYS_IGNORE only
  }
  return (relPosixPath: string): boolean => {
    const top = relPosixPath.split('/')[0]
    if (ALWAYS_IGNORE.has(top)) return true
    return rules.some((re) => re.test(relPosixPath))
  }
}
