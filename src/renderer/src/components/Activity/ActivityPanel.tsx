import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckSquare, Square, History, Play } from 'lucide-react'
import { useActivityStore } from '@renderer/store/activityStore'
import { useExplorerStore } from '@renderer/store/explorerStore'
import { useTerminalStore, nextTerminalId } from '@renderer/store/terminalStore'
import { basename } from '@renderer/components/Explorer/pathUtils'
import type { TranscriptToolCall } from '@shared/types'

interface ActivityPanelProps {
  active: boolean
  onResumed: () => void
}

/** Rough public per-1M-token rates for the default model — labeled as an estimate, not billing truth. */
const RATE_PER_M = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 }

function summarize(call: TranscriptToolCall): string {
  const input = call.input
  switch (call.name) {
    case 'Bash':
      return typeof input.description === 'string' ? input.description : String(input.command ?? '')
    case 'Task':
      return typeof input.description === 'string' ? input.description : 'subagente'
    case 'TodoWrite':
      return 'atualizou a lista de tarefas'
    default: {
      const path = input.file_path ?? input.path ?? input.notebook_path
      return typeof path === 'string' ? basename(path) : call.name
    }
  }
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function Sparkline({ values }: { values: number[] }): JSX.Element | null {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const w = 160
  const h = 28
  const step = w / (values.length - 1)
  const points = values.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline points={points} fill="none" stroke="var(--ink-cyan)" strokeWidth="1.5" />
    </svg>
  )
}

export default function ActivityPanel({ active, onResumed }: ActivityPanelProps): JSX.Element {
  const rootPath = useExplorerStore((s) => s.rootPath)
  const transcript = useActivityStore((s) => s.transcript)
  const sessions = useActivityStore((s) => s.sessions)
  const loadSessions = useActivityStore((s) => s.loadSessions)
  const addTab = useTerminalStore((s) => s.addTab)
  const [showSessions, setShowSessions] = useState(false)

  useEffect(() => {
    if (active && showSessions && rootPath) void loadSessions(rootPath)
  }, [active, showSessions, rootPath, loadSessions])

  const totals = useMemo(() => {
    const usage = transcript?.usage ?? []
    return usage.reduce(
      (acc, u) => ({
        input: acc.input + u.inputTokens,
        output: acc.output + u.outputTokens,
        cacheWrite: acc.cacheWrite + u.cacheCreationTokens,
        cacheRead: acc.cacheRead + u.cacheReadTokens
      }),
      { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }
    )
  }, [transcript])

  const estimatedCost =
    (totals.input * RATE_PER_M.input +
      totals.output * RATE_PER_M.output +
      totals.cacheWrite * RATE_PER_M.cacheWrite +
      totals.cacheRead * RATE_PER_M.cacheRead) /
    1_000_000

  const sparkValues = (transcript?.usage ?? []).map((u) => u.outputTokens).slice(-40)

  const resumeSession = (sessionId: string): void => {
    if (!rootPath) return
    addTab({
      id: nextTerminalId(),
      cwd: rootPath,
      title: `resume ${sessionId.slice(0, 8)}`,
      kind: 'claude',
      shellId: null,
      isRunning: true,
      exitCode: null,
      autoRunCommand: `claude --resume ${sessionId}`
    })
    onResumed()
  }

  return (
    <div className="flex h-full w-full flex-col" style={{ display: active ? 'flex' : 'none' }}>
      <div className="flex items-center gap-2 border-b border-base-700/60 px-3 py-1.5 text-xs text-base-300">
        <span className="font-medium text-base-200">Atividade</span>
        {transcript && <span className="tabular-nums text-base-500">sessão {transcript.sessionId.slice(0, 8)}</span>}
        <div className="flex-1" />
        <button
          className={`flex items-center gap-1 rounded px-2 py-1 hover:bg-base-700/60 ${showSessions ? 'text-accent' : 'text-base-400'}`}
          onClick={() => setShowSessions((v) => !v)}
        >
          <History size={12} />
          sessões
        </button>
      </div>

      <div className="surface-tint min-h-0 flex-1 overflow-y-auto">
        {!transcript && <div className="p-4 text-xs text-base-500">Nenhuma atividade ainda nesta sessão.</div>}

        {transcript?.unrecognizedFormat && (
          <div className="m-2 flex items-center gap-2 rounded border border-ink-yellow/50 bg-ink-yellow/10 px-2 py-1.5 text-[11px] text-ink-yellow">
            <AlertTriangle size={13} />
            Formato de transcript não reconhecido — atualize o vibeIDE.
          </div>
        )}

        {showSessions && (
          <div className="border-b border-base-800 p-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-base-500">Sessões anteriores</div>
            {sessions.length === 0 && <div className="text-[11px] text-base-500">Nenhuma sessão encontrada.</div>}
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-base-800/70">
                <span className="min-w-0 flex-1 truncate text-[11px] text-base-300" title={s.firstUserMessage ?? s.id}>
                  {s.firstUserMessage ?? s.id.slice(0, 8)}
                </span>
                <span className="tabular-nums text-[10px] text-base-600">{new Date(s.mtimeMs).toLocaleDateString('pt-BR')}</span>
                <button
                  title="Copiar comando de retomada (claude --resume) — cole no terminal"
                  className="rounded p-1 text-base-400 hover:bg-base-700/60 hover:text-accent"
                  onClick={() => resumeSession(s.id)}
                >
                  <Play size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {transcript && transcript.todos.length > 0 && (
          <div className="border-b border-base-800 p-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-base-500">Tarefas</div>
            {transcript.todos.map((t, i) => (
              <div key={i} className="flex items-center gap-1.5 py-0.5 text-[12px]">
                {t.status === 'completed' ? (
                  <CheckSquare size={12} className="shrink-0 text-muted" />
                ) : (
                  <Square size={12} className={`shrink-0 ${t.status === 'in_progress' ? 'text-ink-yellow' : 'text-base-500'}`} />
                )}
                <span className={t.status === 'completed' ? 'text-muted line-through' : 'text-base-200'}>{t.content}</span>
              </div>
            ))}
          </div>
        )}

        {transcript && transcript.usage.length > 0 && (
          <div className="border-b border-base-800 p-2">
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-base-500">
              <span>Tokens · sessão</span>
              <Sparkline values={sparkValues} />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums text-[11px] text-base-400">
              <span>entrada: {totals.input.toLocaleString('pt-BR')}</span>
              <span>saída: {totals.output.toLocaleString('pt-BR')}</span>
              <span>cache escrita: {totals.cacheWrite.toLocaleString('pt-BR')}</span>
              <span>cache leitura: {totals.cacheRead.toLocaleString('pt-BR')}</span>
            </div>
            <div className="mt-1 tabular-nums text-[11px] text-base-500">≈ ${estimatedCost.toFixed(3)} (estimativa, taxa fixa)</div>
          </div>
        )}

        {transcript && (
          <div className="p-2">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-base-500">Linha do tempo</div>
            {[...transcript.toolCalls]
              .slice()
              .reverse()
              .map((call) => (
                <div key={call.id} className="flex items-start gap-2 py-0.5 text-[11px]">
                  <span className="w-16 shrink-0 tabular-nums text-base-600">{formatTime(call.timestamp)}</span>
                  <span className={`shrink-0 font-mono ${call.isError ? 'text-danger' : 'text-ink-cyan'}`}>{call.name}</span>
                  {call.isSidechain && <span className="shrink-0 rounded bg-base-800 px-1 text-[9px] text-base-500">subagente</span>}
                  <span className="min-w-0 flex-1 truncate text-base-400">{summarize(call)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
