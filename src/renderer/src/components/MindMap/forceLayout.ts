import type { GraphNode, GraphEdge } from '@shared/types'

export interface LayoutNode {
  x: number
  y: number
  vx: number
  vy: number
}

export type LayoutMap = Map<string, LayoutNode>

/** Seeds positions clustered by directory in a ring, so the force simulation converges in fewer ticks. */
export function initLayout(nodes: GraphNode[], width: number, height: number): LayoutMap {
  const dirs = Array.from(new Set(nodes.map((n) => n.dir)))
  const dirIndex = new Map(dirs.map((d, i) => [d, i]))
  const dirSeq = new Map<string, number>()
  const positions: LayoutMap = new Map()
  const cx = width / 2
  const cy = height / 2
  const ring = Math.max(120, Math.min(width, height) * 0.35)

  for (const n of nodes) {
    const idx = dirIndex.get(n.dir) ?? 0
    const angle = (idx / Math.max(1, dirs.length)) * Math.PI * 2
    const seq = dirSeq.get(n.dir) ?? 0
    dirSeq.set(n.dir, seq + 1)
    const localAngle = seq * 0.9
    const localRadius = 18 + seq * 9
    positions.set(n.id, {
      x: cx + Math.cos(angle) * ring + Math.cos(localAngle) * localRadius * 0.4,
      y: cy + Math.sin(angle) * ring + Math.sin(localAngle) * localRadius * 0.4,
      vx: 0,
      vy: 0
    })
  }
  return positions
}

const REPEL_RANGE_SQ = 42000
const CELL_SIZE = Math.sqrt(REPEL_RANGE_SQ) // grid cell = repulsion cutoff, so a 3x3 neighborhood covers it
const REPEL_STRENGTH = 1600
const SPRING_LENGTH = 95
const SPRING_STRENGTH = 0.02
const CENTER_STRENGTH = 0.0006
const DAMPING = 0.82
/** below this squared velocity the layout is visually still — lets callers stop ticking early */
export const CONVERGED_SPEED_SQ = 0.01

function cellKey(x: number, y: number): string {
  return `${Math.floor(x / CELL_SIZE)}:${Math.floor(y / CELL_SIZE)}`
}

/** Buckets node ids by grid cell so repulsion only compares nearby nodes instead of every pair. */
function buildGrid(ids: string[], positions: LayoutMap): Map<string, string[]> {
  const grid = new Map<string, string[]>()
  for (const id of ids) {
    const p = positions.get(id)
    if (!p) continue
    const key = cellKey(p.x, p.y)
    let bucket = grid.get(key)
    if (!bucket) {
      bucket = []
      grid.set(key, bucket)
    }
    bucket.push(id)
  }
  return grid
}

/**
 * One step of a simple force simulation: local repulsion (via spatial grid,
 * ~O(n) instead of O(n^2)) + spring edges + centering. Returns the largest
 * squared velocity so callers can stop ticking once the layout settles
 * instead of always running a fixed number of frames.
 */
export function tickLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  positions: LayoutMap,
  width: number,
  height: number,
  pinned: string | null
): number {
  const ids = nodes.map((n) => n.id)
  const grid = buildGrid(ids, positions)

  for (const idA of ids) {
    if (idA === pinned) continue
    const a = positions.get(idA)
    if (!a) continue
    const cellX = Math.floor(a.x / CELL_SIZE)
    const cellY = Math.floor(a.y / CELL_SIZE)
    let fx = 0
    let fy = 0
    for (let gx = cellX - 1; gx <= cellX + 1; gx++) {
      for (let gy = cellY - 1; gy <= cellY + 1; gy++) {
        const bucket = grid.get(`${gx}:${gy}`)
        if (!bucket) continue
        for (const idB of bucket) {
          if (idB === idA) continue
          const b = positions.get(idB)
          if (!b) continue
          const dx = a.x - b.x
          const dy = a.y - b.y
          const distSq = dx * dx + dy * dy || 0.01
          if (distSq > REPEL_RANGE_SQ) continue
          const dist = Math.sqrt(distSq)
          const force = REPEL_STRENGTH / distSq
          fx += (dx / dist) * force
          fy += (dy / dist) * force
        }
      }
    }
    a.vx = (a.vx + fx) * DAMPING
    a.vy = (a.vy + fy) * DAMPING
  }

  for (const e of edges) {
    const a = positions.get(e.source)
    const b = positions.get(e.target)
    if (!a || !b) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
    const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    if (e.source !== pinned) {
      a.vx += fx
      a.vy += fy
    }
    if (e.target !== pinned) {
      b.vx -= fx
      b.vy -= fy
    }
  }

  const cx = width / 2
  const cy = height / 2
  let maxSpeedSq = 0
  for (const id of ids) {
    if (id === pinned) continue
    const p = positions.get(id)
    if (!p) continue
    p.vx += (cx - p.x) * CENTER_STRENGTH
    p.vy += (cy - p.y) * CENTER_STRENGTH
    p.x += p.vx
    p.y += p.vy
    const speedSq = p.vx * p.vx + p.vy * p.vy
    if (speedSq > maxSpeedSq) maxSpeedSq = speedSq
  }
  return maxSpeedSq
}
