import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Square, Send, RefreshCw, AlertCircle } from 'lucide-react'
import { useExplorerStore } from '@renderer/store/explorerStore'
import { useTerminalStore } from '@renderer/store/terminalStore'
import { ansiToHtml } from './ansi'
import type { PackageScript, DiagnosticsResult, ConsoleErrorEntry } from '@shared/types'

interface VerificationPanelProps {
  active: boolean
}

const MAX_OUTPUT_CHARS = 200_000

export default function VerificationPanel({ active }: VerificationPanelProps): JSX.Element {
  const rootPath = useExplorerStore((s) => s.rootPath)
  const activeTabId = useTerminalStore((s) => s.activeTabId)

  const [scripts, setScripts] = useState<PackageScript[]>([])
  const [selected, setSelected] = useState('')
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [port, setPort] = useState<number | null>(null)
  const [exitCode, setExitCode] = useState<number | null | undefined>(undefined)
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [consoleErrors, setConsoleErrors] = useState<ConsoleErrorEntry[]>([])
  const [sentFeedback, setSentFeedback] = useState<string | null>(null)

  const outputRef = useRef<HTMLPreElement>(null)
  const webviewRef = useRef<Electron.WebviewTag | null>(null)

  useEffect(() => {
    if (!rootPath) return
    void window.api.scripts.list(rootPath).then((list) => {
      setScripts(list)
      if (list.length > 0) setSelected((s) => s || list[0].name)
    })
  }, [rootPath])

  useEffect(() => {
    const offOutput = window.api.scripts.onOutput((chunk) => {
      setOutput((prev) => (prev + chunk.text).slice(-MAX_OUTPUT_CHARS))
    })
    const offStatus = window.api.scripts.onStatus((evt) => {
      if (evt.type === 'server-detected' && evt.port) setPort(evt.port)
      if (evt.type === 'exit') {
        setRunning(false)
        setExitCode(evt.exitCode ?? null)
      }
    })
    return () => {
      offOutput()
      offStatus()
    }
  }, [])

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight })
  }, [output])

  const run = async (): Promise<void> => {
    if (!rootPath || !selected) return
    setOutput('')
    setPort(null)
    setExitCode(undefined)
    setRunning(true)
    await window.api.scripts.run(rootPath, selected)
  }

  const stop = async (): Promise<void> => {
    await window.api.scripts.stop()
    setRunning(false)
  }

  const runDiagnostics = async (): Promise<void> => {
    if (!rootPath) return
    setDiagnosticsLoading(true)
    setDiagnostics(await window.api.diagnostics.run(rootPath))
    setDiagnosticsLoading(false)
  }

  const recordConsoleError = useCallback((entry: ConsoleErrorEntry): void => {
    setConsoleErrors((prev) => [...prev.slice(-199), entry])
    void window.api.consoleErrors.report(entry)
  }, [])

  // Stable identity is the whole point: as an inline function this ref callback was a new
  // function every render, so React detached and re-ran it on each one — stacking a fresh pair
  // of listeners on the *same* webview element. While a dev server streams output (a re-render
  // per chunk) that meant every console error being recorded dozens of times over.
  const attachWebviewListeners = useCallback((el: Electron.WebviewTag | null): void => {
    webviewRef.current = el
    if (!el) return
    el.addEventListener('console-message', (e) => {
      // Electron's console-message level: 0=verbose, 1=info, 2=warning, 3=error
      if (e.level === 3) {
        recordConsoleError({ timestamp: new Date().toISOString(), type: 'console-error', message: e.message, source: `${e.sourceId}:${e.line}` })
      }
    })
    el.addEventListener('did-fail-load', (e) => {
      if (e.errorCode === -3) return // ERR_ABORTED — routine (e.g. HMR navigations), not a real failure
      recordConsoleError({ timestamp: new Date().toISOString(), type: 'failed-request', message: `${e.errorDescription} (${e.validatedURL})` })
    })
  }, [recordConsoleError])

  const sendToClaude = (entry: ConsoleErrorEntry): void => {
    if (!activeTabId) return
    const formatted = `Erro no preview (${entry.type}): ${entry.message}${entry.source ? `\nOrigem: ${entry.source}` : ''}\n`
    void window.api.pty.write(activeTabId, formatted)
    setSentFeedback(`Enviado pro terminal: ${entry.message.slice(0, 60)}`)
    setTimeout(() => setSentFeedback(null), 2000)
  }

  const tscCount = diagnostics?.typescript.issues.length ?? 0
  const eslintCount = Array.isArray(diagnostics?.eslint.issues) ? diagnostics!.eslint.issues.length : 0

  return (
    <div className="flex h-full w-full flex-col" style={{ display: active ? 'flex' : 'none' }}>
      <div className="flex items-center gap-2 border-b border-base-700/60 px-3 py-1.5 text-xs text-base-300">
        <span className="font-medium text-base-200">Verificação</span>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded border border-base-700/60 bg-base-900 px-1.5 py-0.5 text-[11px] text-base-200"
        >
          {scripts.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        {!running ? (
          <button onClick={() => void run()} disabled={!selected} className="flex items-center gap-1 rounded bg-accent px-2 py-1 text-[11px] text-base-950 hover:bg-accent-bright disabled:opacity-40">
            <Play size={11} />
            rodar
          </button>
        ) : (
          <button onClick={() => void stop()} className="flex items-center gap-1 rounded bg-danger px-2 py-1 text-[11px] text-base-950 hover:bg-danger/80">
            <Square size={11} />
            parar
          </button>
        )}
        {exitCode !== undefined && exitCode !== null && (
          <span className={`tabular-nums ${exitCode === 0 ? 'text-accent' : 'text-danger'}`}>código {exitCode}</span>
        )}
        {port && <span className="tabular-nums text-base-500">porta {port}</span>}
        <div className="flex-1" />
        <button onClick={() => void runDiagnostics()} className="flex items-center gap-1 rounded px-2 py-1 text-base-400 hover:bg-base-700/60">
          <RefreshCw size={11} className={diagnosticsLoading ? 'animate-spin' : ''} />
          diagnósticos {tscCount + eslintCount > 0 && <span className="tabular-nums text-ink-yellow">({tscCount + eslintCount})</span>}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 flex-col border-r border-base-800">
          <pre ref={outputRef} className="min-h-0 flex-1 overflow-auto bg-base-900 px-2 py-1.5 font-mono text-[11px] leading-[1.5] text-base-300" dangerouslySetInnerHTML={{ __html: ansiToHtml(output) || '<span class="text-base-600">sem saída ainda</span>' }} />
          {(diagnostics?.typescript.issues.length ?? 0) > 0 && (
            <div className="max-h-32 overflow-y-auto border-t border-base-800 p-1.5">
              {diagnostics!.typescript.issues.map((issue, i) => (
                <div key={i} className="truncate font-mono text-[10px] text-danger" title={issue.message}>
                  {issue.file}:{issue.line} — {issue.message}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex w-[45%] min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-base-800 px-2 py-1 text-[10px] text-base-500">
            <span>preview {port ? `localhost:${port}` : '(aguardando servidor)'}</span>
          </div>
          {port ? (
            <webview ref={attachWebviewListeners} src={`http://localhost:${port}`} className="min-h-0 flex-1" allowpopups={false} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[11px] text-base-500">Rode um script com servidor de dev pra ver o preview aqui.</div>
          )}
          <div className="max-h-40 overflow-y-auto border-t border-base-800">
            {consoleErrors.length === 0 && <div className="p-2 text-[11px] text-base-500">Sem erros de console capturados.</div>}
            {[...consoleErrors].reverse().map((entry, i) => (
              <div key={i} className="flex items-start gap-1.5 border-b border-base-800/60 px-2 py-1">
                <AlertCircle size={11} className="mt-0.5 shrink-0 text-danger" />
                <span className="min-w-0 flex-1 truncate text-[10px] text-base-300" title={entry.message}>
                  {entry.message}
                </span>
                <button
                  onClick={() => sendToClaude(entry)}
                  disabled={!activeTabId}
                  title="Mandar pro Claude"
                  className="shrink-0 rounded p-0.5 text-base-500 hover:bg-base-700/60 hover:text-accent disabled:opacity-30"
                >
                  <Send size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {sentFeedback && <div className="border-t border-rule px-3 py-1 text-[10px] text-accent">{sentFeedback}</div>}
    </div>
  )
}
