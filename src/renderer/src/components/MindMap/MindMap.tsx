import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCw, Waypoints } from 'lucide-react'
import type { ProjectGraph } from '@shared/types'
import { join } from '@renderer/components/Explorer/pathUtils'
import { useExplorerStore } from '@renderer/store/explorerStore'
import { formatSize, formatTokens } from '@renderer/components/Preview/tokenEstimate'
import { initLayout, tickLayout, CONVERGED_SPEED_SQ, type LayoutMap } from './forceLayout'
import { colorForDir } from './colors'

interface MindMapProps {
  rootPath: string | null
  active: boolean
}

const MAX_SIMULATED_NODES = 2000
const MAX_TICKS = 260
const MIN_SCALE = 0.15
const MAX_SCALE = 3
const LABEL_ZOOM_THRESHOLD = 1.1
const TRANSFORM_COMMIT_DEBOUNCE_MS = 120

interface ViewTransform {
  x: number
  y: number
  k: number
}

function toAbsolutePath(root: string, relId: string): string {
  return relId.split('/').reduce((acc, seg) => join(acc, seg), root)
}

function transformAttr(t: ViewTransform): string {
  return `translate(${t.x},${t.y}) scale(${t.k})`
}

export default function MindMap({ rootPath, active }: MindMapProps): JSX.Element {
  const setPreview = useExplorerStore((s) => s.setPreview)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const nodeElsRef = useRef<Map<string, SVGGElement>>(new Map())
  const edgeElsRef = useRef<Map<number, SVGLineElement>>(new Map())
  const positionsRef = useRef<LayoutMap>(new Map())
  const draggingRef = useRef<string | null>(null)
  const panRef = useRef<{ startX: number; startY: number; origin: ViewTransform } | null>(null)
  const dragMovedRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const sizeRef = useRef({ width: 800, height: 600 })
  // live pan/zoom value, applied straight to the DOM every frame; `transform`
  // state below only mirrors it for the occasional real re-render (selection,
  // reload, label-visibility threshold) so panning/zooming never re-renders
  // every node and edge.
  const transformRef = useRef<ViewTransform>({ x: 0, y: 0, k: 1 })
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // stable escape hatches so the mount-once mousemove/mouseup listener below
  // can always reach the current graph/rootPath/callbacks without needing to
  // be torn down and re-attached whenever those change.
  const graphRef = useRef<ProjectGraph | null>(null)
  const rootPathRef = useRef<string | null>(null)
  const applyPositionsToDomRef = useRef<(g: ProjectGraph) => void>(() => {})
  const applyTransformToDomRef = useRef<() => void>(() => {})

  const [graph, setGraph] = useState<ProjectGraph | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, k: 1 })

  const applyPositionsToDom = useCallback((currentGraph: ProjectGraph) => {
    const positions = positionsRef.current
    for (const n of currentGraph.nodes) {
      const el = nodeElsRef.current.get(n.id)
      const p = positions.get(n.id)
      if (el && p) el.setAttribute('transform', `translate(${p.x},${p.y})`)
    }
    for (let i = 0; i < currentGraph.edges.length; i++) {
      const e = currentGraph.edges[i]
      const el = edgeElsRef.current.get(i)
      const a = positions.get(e.source)
      const b = positions.get(e.target)
      if (el && a && b) {
        el.setAttribute('x1', String(a.x))
        el.setAttribute('y1', String(a.y))
        el.setAttribute('x2', String(b.x))
        el.setAttribute('y2', String(b.y))
      }
    }
  }, [])

  const applyTransformToDom = useCallback(() => {
    gRef.current?.setAttribute('transform', transformAttr(transformRef.current))
  }, [])

  /** Syncs the live transform into React state so the occasional real render sees it — debounced so rapid pan/zoom doesn't thrash React. */
  const scheduleTransformCommit = useCallback(() => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
    commitTimerRef.current = setTimeout(() => {
      setTransform({ ...transformRef.current })
    }, TRANSFORM_COMMIT_DEBOUNCE_MS)
  }, [])

  const build = useCallback(async (path: string) => {
    setLoading(true)
    setError(null)
    setSelectedId(null)
    try {
      const result = await window.api.graph.build(path)
      const width = containerRef.current?.clientWidth || sizeRef.current.width || 800
      const height = containerRef.current?.clientHeight || sizeRef.current.height || 600
      sizeRef.current = { width, height }
      positionsRef.current = initLayout(result.nodes, width, height)
      transformRef.current = { x: 0, y: 0, k: 1 }
      setTransform(transformRef.current)
      setGraph(result)
    } catch {
      setError('Não foi possível ler o projeto.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      sizeRef.current = { width: entry.contentRect.width, height: entry.contentRect.height }
    })
    observer.observe(el)
    sizeRef.current = { width: el.clientWidth, height: el.clientHeight }
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (active && rootPath && !graph && !loading) {
      void build(rootPath)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, rootPath])

  // Force simulation: runs off the React render cycle entirely. Positions
  // are pushed straight to the SVG DOM via refs each tick, and it stops as
  // soon as the layout settles (or the tick cap is hit) instead of always
  // burning the full budget.
  useEffect(() => {
    if (!graph) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (graph.nodes.length === 0 || graph.nodes.length > MAX_SIMULATED_NODES) return

    let frame = 0
    const step = (): void => {
      const { width, height } = sizeRef.current
      const maxSpeedSq = tickLayout(graph.nodes, graph.edges, positionsRef.current, width, height, draggingRef.current)
      applyPositionsToDom(graph)
      frame++
      if (frame < MAX_TICKS && maxSpeedSq > CONVERGED_SPEED_SQ) {
        rafRef.current = requestAnimationFrame(step)
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [graph, applyPositionsToDom])

  const handleWheel = (e: React.WheelEvent): void => {
    e.preventDefault()
    const rect = svgRef.current!.getBoundingClientRect()
    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const t = transformRef.current
    const nextK = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.k * factor))
    const worldX = (cursorX - t.x) / t.k
    const worldY = (cursorY - t.y) / t.k
    transformRef.current = { k: nextK, x: cursorX - worldX * nextK, y: cursorY - worldY * nextK }
    applyTransformToDom()
    scheduleTransformCommit()
  }

  const handleBackgroundMouseDown = (e: React.MouseEvent): void => {
    if (e.target !== svgRef.current && (e.target as SVGElement).dataset?.role !== 'background') return
    panRef.current = { startX: e.clientX, startY: e.clientY, origin: transformRef.current }
    setSelectedId(null)
  }

  const handleNodeMouseDown = (id: string) => (e: React.MouseEvent): void => {
    e.stopPropagation()
    draggingRef.current = id
    dragMovedRef.current = false
  }

  // Registered once — reads everything through refs so panning/dragging never has
  // to tear down and re-add these listeners mid-gesture.
  useEffect(() => {
    const screenToWorld = (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = svgRef.current!.getBoundingClientRect()
      const t = transformRef.current
      return { x: (clientX - rect.left - t.x) / t.k, y: (clientY - rect.top - t.y) / t.k }
    }

    const handleMove = (e: MouseEvent): void => {
      if (draggingRef.current) {
        dragMovedRef.current = true
        const pos = positionsRef.current.get(draggingRef.current)
        if (pos) {
          const world = screenToWorld(e.clientX, e.clientY)
          pos.x = world.x
          pos.y = world.y
          pos.vx = 0
          pos.vy = 0
          const current = graphRef.current
          if (current) applyPositionsToDomRef.current(current)
        }
        return
      }
      if (panRef.current) {
        const dx = e.clientX - panRef.current.startX
        const dy = e.clientY - panRef.current.startY
        transformRef.current = {
          x: panRef.current.origin.x + dx,
          y: panRef.current.origin.y + dy,
          k: panRef.current.origin.k
        }
        applyTransformToDomRef.current()
      }
    }
    const handleUp = (): void => {
      if (draggingRef.current) {
        if (!dragMovedRef.current) {
          const draggedId = draggingRef.current
          setSelectedId((prev) => (prev === draggedId ? null : draggedId))
          const current = graphRef.current
          if (current && rootPathRef.current) {
            const node = current.nodes.find((n) => n.id === draggedId)
            if (node) {
              const abs = toAbsolutePath(rootPathRef.current, node.id)
              void window.api.fs.reveal(abs)
              setPreview(abs)
            }
          }
        }
        draggingRef.current = null
      }
      if (panRef.current) {
        panRef.current = null
        setTransform({ ...transformRef.current })
      }
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

  useEffect(() => {
    graphRef.current = graph
    rootPathRef.current = rootPath
    applyPositionsToDomRef.current = applyPositionsToDom
    applyTransformToDomRef.current = applyTransformToDom
  })

  const neighbors = new Set<string>()
  if (graph && selectedId) {
    for (const e of graph.edges) {
      if (e.source === selectedId) neighbors.add(e.target)
      if (e.target === selectedId) neighbors.add(e.source)
    }
  }

  const totalSize = graph ? graph.nodes.reduce((sum, n) => sum + n.size, 0) : 0

  return (
    <div className="flex h-full w-full flex-col" style={{ display: active ? 'flex' : 'none' }}>
      <div className="flex items-center gap-2 border-b border-base-700/60 px-3 py-1.5 text-xs text-base-300">
        <Waypoints size={13} className="text-accent" />
        <span className="font-medium text-base-200">Mapa mental do projeto</span>
        {graph && (
          <span className="text-base-400">
            {graph.nodes.length} arquivos · {graph.edges.length} conexões · {formatSize(totalSize)} (
            {formatTokens(Math.round(totalSize / 4))} se colado inteiro no chat)
            {graph.truncated ? ' · parcial (projeto grande)' : ''}
          </span>
        )}
        <div className="flex-1" />
        <button
          className="flex items-center gap-1 rounded px-2 py-1 text-base-400 hover:bg-base-700/60 hover:text-base-200 disabled:opacity-40"
          disabled={!rootPath || loading}
          onClick={() => rootPath && void build(rootPath)}
          title="Reconstruir mapa (leitura local, sem uso de IA)"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Reconstruir
        </button>
      </div>
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden bg-base-900">
        {!rootPath && (
          <div className="flex h-full items-center justify-center text-xs text-base-400">
            Abra uma pasta para ver o mapa mental.
          </div>
        )}
        {rootPath && loading && !graph && (
          <div className="flex h-full items-center justify-center text-xs text-base-400">
            Lendo arquivos do projeto…
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center text-xs text-danger">{error}</div>
        )}
        {rootPath && graph && graph.nodes.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-base-400">
            Nenhum arquivo de código reconhecido neste projeto.
          </div>
        )}
        {graph && graph.nodes.length > 0 && (
          <svg
            ref={svgRef}
            className="h-full w-full cursor-grab active:cursor-grabbing"
            onWheel={handleWheel}
            onMouseDown={handleBackgroundMouseDown}
          >
            <rect data-role="background" x={0} y={0} width="100%" height="100%" fill="transparent" />
            <g ref={gRef} transform={transformAttr(transform)}>
              {graph.edges.map((e, i) => {
                const a = positionsRef.current.get(e.source)
                const b = positionsRef.current.get(e.target)
                if (!a || !b) return null
                const dimmed = selectedId && e.source !== selectedId && e.target !== selectedId
                return (
                  <line
                    key={i}
                    ref={(el) => {
                      if (el) edgeElsRef.current.set(i, el)
                      else edgeElsRef.current.delete(i)
                    }}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={dimmed ? 'rgba(255,255,255,0.05)' : 'rgba(57,217,138,0.35)'}
                    strokeWidth={1}
                  />
                )
              })}
              {graph.nodes.map((n) => {
                const p = positionsRef.current.get(n.id)
                if (!p) return null
                const isSelected = n.id === selectedId
                const isNeighbor = neighbors.has(n.id)
                const dimmed = selectedId && !isSelected && !isNeighbor
                const radius = isSelected ? 7 : 5
                return (
                  <g
                    key={n.id}
                    ref={(el) => {
                      if (el) nodeElsRef.current.set(n.id, el)
                      else nodeElsRef.current.delete(n.id)
                    }}
                    transform={`translate(${p.x},${p.y})`}
                    onMouseDown={handleNodeMouseDown(n.id)}
                    style={{ cursor: 'pointer', opacity: dimmed ? 0.25 : 1 }}
                  >
                    <title>
                      {`${n.id}\n${formatSize(n.size)} · ${formatTokens(Math.round(n.size / 4))}`}
                    </title>
                    <circle
                      r={radius}
                      fill={colorForDir(n.dir)}
                      stroke={isSelected ? '#fff' : 'rgba(0,0,0,0.4)'}
                      strokeWidth={isSelected ? 1.5 : 0.5}
                    />
                    {(isSelected || transform.k > LABEL_ZOOM_THRESHOLD) && (
                      <text x={9} y={3} fontSize={10} fill="#c4c4cc" style={{ userSelect: 'none' }}>
                        {n.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>
        )}
      </div>
    </div>
  )
}
