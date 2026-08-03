import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { RefreshCw, Waypoints, Copy, X, ChevronsRight } from 'lucide-react'
import type { ProjectGraph, GraphNode } from '@shared/types'
import { join } from '@renderer/components/Explorer/pathUtils'
import { useExplorerStore } from '@renderer/store/explorerStore'
import { formatSize, formatTokens } from '@renderer/components/Preview/tokenEstimate'
import { treemap, type Rect } from './treemapLayout'
import { inkFillClass } from './colors'

interface MindMapProps {
  rootPath: string | null
  active: boolean
}

const MIN_SCALE = 0.15
const MAX_SCALE = 8
/** rect must render at least this wide/tall (world units × zoom) before its label is worth drawing */
const LABEL_MIN_W = 34
const LABEL_MIN_H = 14
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
  const gitStatus = useExplorerStore((s) => s.gitStatus)
  const touchedFiles = useExplorerStore((s) => s.touchedFiles)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const panRef = useRef<{ startX: number; startY: number; origin: ViewTransform } | null>(null)
  const transformRef = useRef<ViewTransform>({ x: 0, y: 0, k: 1 })
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sizeRef = useRef({ width: 800, height: 600 })

  const [graph, setGraph] = useState<ProjectGraph | null>(null)
  const [rects, setRects] = useState<Map<string, Rect>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandLevels, setExpandLevels] = useState(1)
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, k: 1 })
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

  const applyTransformToDom = useCallback(() => {
    gRef.current?.setAttribute('transform', transformAttr(transformRef.current))
  }, [])

  const scheduleTransformCommit = useCallback(() => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current)
    commitTimerRef.current = setTimeout(() => setTransform({ ...transformRef.current }), TRANSFORM_COMMIT_DEBOUNCE_MS)
  }, [])

  const recomputeLayout = useCallback((g: ProjectGraph) => {
    const width = containerRef.current?.clientWidth || sizeRef.current.width || 800
    const height = containerRef.current?.clientHeight || sizeRef.current.height || 600
    sizeRef.current = { width, height }
    setRects(treemap(g.nodes.map((n) => ({ id: n.id, weight: n.tokenWeight })), 0, 0, width, height))
  }, [])

  const build = useCallback(
    async (p: string) => {
      setLoading(true)
      setError(null)
      setSelectedIds(new Set())
      try {
        const result = await window.api.graph.build(p)
        transformRef.current = { x: 0, y: 0, k: 1 }
        setTransform(transformRef.current)
        setGraph(result)
        recomputeLayout(result)
      } catch {
        setError('Não foi possível ler o projeto.')
      } finally {
        setLoading(false)
      }
    },
    [recomputeLayout]
  )

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      sizeRef.current = { width: entry.contentRect.width, height: entry.contentRect.height }
      if (graph) recomputeLayout(graph)
    })
    observer.observe(el)
    sizeRef.current = { width: el.clientWidth, height: el.clientHeight }
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  useEffect(() => {
    if (active && rootPath && !graph && !loading) void build(rootPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, rootPath])

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
  }

  useEffect(() => {
    const handleMove = (e: MouseEvent): void => {
      if (!panRef.current) return
      const dx = e.clientX - panRef.current.startX
      const dy = e.clientY - panRef.current.startY
      transformRef.current = { x: panRef.current.origin.x + dx, y: panRef.current.origin.y + dy, k: panRef.current.origin.k }
      applyTransformToDom()
    }
    const handleUp = (): void => {
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
  }, [applyTransformToDom])

  const clickNode = (n: GraphNode): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(n.id)) next.delete(n.id)
      else next.add(n.id)
      return next
    })
    if (rootPath) {
      const abs = toAbsolutePath(rootPath, n.id)
      void window.api.fs.reveal(abs)
      setPreview(abs)
    }
  }

  const expandSelection = (): void => {
    if (!graph) return
    const adjacency = new Map<string, Set<string>>()
    for (const e of graph.edges) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, new Set())
      if (!adjacency.has(e.target)) adjacency.set(e.target, new Set())
      adjacency.get(e.source)!.add(e.target)
      adjacency.get(e.target)!.add(e.source)
    }
    let frontier = new Set(selectedIds)
    const next = new Set(selectedIds)
    for (let i = 0; i < expandLevels && frontier.size > 0; i++) {
      const grown = new Set<string>()
      for (const id of frontier) {
        for (const neighbor of adjacency.get(id) ?? []) {
          if (!next.has(neighbor)) {
            next.add(neighbor)
            grown.add(neighbor)
          }
        }
      }
      frontier = grown
    }
    setSelectedIds(next)
  }

  const copyContext = async (): Promise<void> => {
    if (selectedIds.size === 0) return
    const text = Array.from(selectedIds)
      .map((id) => `@${id}`)
      .join(' ')
    try {
      await navigator.clipboard.writeText(text)
      setCopyStatus(`copiado — ${selectedIds.size} arquivos`)
    } catch {
      setCopyStatus('falha ao copiar')
    }
    setTimeout(() => setCopyStatus(null), 2500)
  }

  const neighbors = useMemo(() => {
    const set = new Set<string>()
    if (graph && selectedIds.size > 0) {
      for (const e of graph.edges) {
        if (selectedIds.has(e.source)) set.add(e.target)
        if (selectedIds.has(e.target)) set.add(e.source)
      }
    }
    return set
  }, [graph, selectedIds])

  const selectedTokens = useMemo(() => {
    if (!graph) return 0
    return graph.nodes.filter((n) => selectedIds.has(n.id)).reduce((s, n) => s + n.tokenWeight, 0)
  }, [graph, selectedIds])

  const totalSize = graph ? graph.nodes.reduce((sum, n) => sum + n.size, 0) : 0
  const showLabel = (r: Rect): boolean => r.w * transform.k > LABEL_MIN_W && r.h * transform.k > LABEL_MIN_H

  return (
    <div className="flex h-full w-full flex-col" style={{ display: active ? 'flex' : 'none' }}>
      <div className="flex items-center gap-2 border-b border-base-700/60 px-3 py-1.5 text-xs text-base-300">
        <Waypoints size={13} className="text-accent" />
        <span className="font-medium text-base-200">Mapa mental do projeto</span>
        {graph && (
          <span className="font-mono tabular-nums text-base-400">
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
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 border-b border-base-700/60 bg-base-800/50 px-3 py-1.5 text-[11px] text-base-300">
          <span className="font-mono tabular-nums">
            {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''} · {formatTokens(selectedTokens)}
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={5}
              value={expandLevels}
              onChange={(e) => setExpandLevels(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
              className="w-10 rounded border border-base-700/60 bg-base-900 px-1 py-0.5 text-center font-mono"
            />
            <button
              onClick={expandSelection}
              className="flex items-center gap-1 rounded px-2 py-1 hover:bg-base-700/60 hover:text-base-100"
              title="Expandir seleção pelos imports (N níveis, nas duas direções)"
            >
              <ChevronsRight size={12} />
              expandir níveis
            </button>
          </div>
          <button onClick={() => void copyContext()} className="flex items-center gap-1 rounded bg-accent px-2 py-1 font-medium text-base-950 hover:bg-accent-bright">
            <Copy size={12} />
            copiar @paths
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-base-700/60 hover:text-base-100">
            <X size={12} />
            limpar
          </button>
          {copyStatus && <span className="text-accent">{copyStatus}</span>}
        </div>
      )}
      <div ref={containerRef} className="surface relative min-h-0 flex-1 overflow-hidden bg-base-900">
        {!rootPath && (
          <div className="flex h-full items-center justify-center text-xs text-base-400">
            Abra uma pasta para ver o mapa mental.
          </div>
        )}
        {rootPath && loading && !graph && (
          <div className="flex h-full items-center justify-center text-xs text-base-400">Lendo arquivos do projeto…</div>
        )}
        {error && <div className="flex h-full items-center justify-center text-xs text-danger">{error}</div>}
        {rootPath && graph && graph.nodes.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-base-400">
            Nenhum arquivo de código reconhecido neste projeto.
          </div>
        )}
        {graph && graph.nodes.length > 0 && (
          <svg ref={svgRef} className="h-full w-full cursor-grab active:cursor-grabbing" onWheel={handleWheel} onMouseDown={handleBackgroundMouseDown}>
            <rect data-role="background" x={0} y={0} width="100%" height="100%" fill="transparent" />
            <g ref={gRef} transform={transformAttr(transform)}>
              {graph.edges.map((e, i) => {
                const a = rects.get(e.source)
                const b = rects.get(e.target)
                if (!a || !b) return null
                const involved = selectedIds.size > 0 && (selectedIds.has(e.source) || selectedIds.has(e.target))
                const dimmed = selectedIds.size > 0 && !involved
                return (
                  <line
                    key={i}
                    x1={a.x + a.w / 2}
                    y1={a.y + a.h / 2}
                    x2={b.x + b.w / 2}
                    y2={b.y + b.h / 2}
                    stroke={dimmed ? 'rgba(255,255,255,0.04)' : e.inCycle ? 'var(--ink-yellow)' : 'var(--rule)'}
                    strokeWidth={1}
                  />
                )
              })}
              {graph.nodes.map((n) => {
                const r = rects.get(n.id)
                if (!r) return null
                const abs = rootPath ? toAbsolutePath(rootPath, n.id) : ''
                const dirty = abs in gitStatus
                const touched = touchedFiles.has(abs)
                const isSelected = selectedIds.has(n.id)
                const isNeighbor = neighbors.has(n.id)
                const dimmed = selectedIds.size > 0 && !isSelected && !isNeighbor
                return (
                  <g
                    key={n.id}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      clickNode(n)
                    }}
                    style={{ cursor: 'pointer', opacity: dimmed ? 0.3 : 1 }}
                  >
                    <title>
                      {`${n.id}\n${formatSize(n.size)} · ${formatTokens(n.tokenWeight)}${n.orphan ? ' · órfão (nada importa nem é importado)' : ''}${
                        n.inCycle ? ' · em ciclo de import' : ''
                      }`}
                    </title>
                    <rect
                      x={r.x}
                      y={r.y}
                      width={Math.max(0, r.w - 1)}
                      height={Math.max(0, r.h - 1)}
                      className={inkFillClass(touched, dirty)}
                      stroke={n.inCycle ? 'var(--ink-yellow)' : isSelected ? 'var(--paper)' : 'var(--rule)'}
                      strokeWidth={n.inCycle || isSelected ? 1.5 : 0.5}
                      strokeDasharray={n.orphan ? '3,2' : undefined}
                    />
                    {showLabel(r) && (
                      <text x={r.x + 4} y={r.y + 12} fontSize={10} className="font-mono" fill="var(--paper)" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                        {n.label.length > 22 ? n.label.slice(0, 20) + '…' : n.label}
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
