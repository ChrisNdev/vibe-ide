export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Weighted {
  id: string
  weight: number
}

/** Rects too small to bother giving their own pixel would be invisible/unclickable — every file gets at least this much of the total weight. */
const MIN_WEIGHT_FRACTION = 0.0015

function layout(items: Weighted[], x: number, y: number, w: number, h: number, out: Map<string, Rect>): void {
  if (items.length === 0) return
  if (items.length === 1) {
    out.set(items[0].id, { x, y, w, h })
    return
  }
  const total = items.reduce((s, i) => s + i.weight, 0)
  let acc = 0
  let splitIdx = 0
  for (let i = 0; i < items.length; i++) {
    acc += items[i].weight
    if (acc >= total / 2) {
      splitIdx = i + 1
      break
    }
  }
  splitIdx = Math.min(Math.max(splitIdx, 1), items.length - 1)
  const left = items.slice(0, splitIdx)
  const right = items.slice(splitIdx)
  const leftWeight = left.reduce((s, i) => s + i.weight, 0)
  const frac = leftWeight / total

  if (w >= h) {
    const splitW = w * frac
    layout(left, x, y, splitW, h, out)
    layout(right, x + splitW, y, w - splitW, h, out)
  } else {
    const splitH = h * frac
    layout(left, x, y, w, splitH, out)
    layout(right, x, y + splitH, w, h - splitH, out)
  }
}

/**
 * Recursive-bisection treemap: splits the item list roughly in half by cumulative weight,
 * always along the container's longer axis, recursing until one item remains per rect.
 * Simpler than a squarified treemap and never produces overlaps or degenerate rects.
 */
export function treemap(items: Weighted[], x: number, y: number, w: number, h: number): Map<string, Rect> {
  const out = new Map<string, Rect>()
  if (w <= 0 || h <= 0 || items.length === 0) return out
  const total = items.reduce((s, i) => s + i.weight, 0)
  if (total <= 0) return out
  const floor = total * MIN_WEIGHT_FRACTION
  const sorted = [...items].sort((a, b) => b.weight - a.weight).map((i) => ({ id: i.id, weight: Math.max(i.weight, floor) }))
  layout(sorted, x, y, w, h, out)
  return out
}
