export interface FuzzyResult {
  score: number
  /** matched character indices into target, for highlighting */
  indices: number[]
}

const BOUNDARY_RE = /[/\\_\-. ]/

/** Subsequence fuzzy match with bonuses for consecutive runs and word-boundary starts — good enough for a file list, no dependency needed. */
export function fuzzyMatch(query: string, target: string): FuzzyResult | null {
  if (!query) return { score: 0, indices: [] }
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0
  let prevMatchIndex = -1
  let score = 0
  const indices: number[] = []

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue
    let charScore = 1
    if (prevMatchIndex === ti - 1) charScore += 2
    if (ti === 0 || BOUNDARY_RE.test(t[ti - 1])) charScore += 2
    score += charScore
    indices.push(ti)
    prevMatchIndex = ti
    qi++
  }

  if (qi < q.length) return null
  return { score: score - t.length * 0.01, indices }
}
