import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { CanvasAddon } from '@xterm/addon-canvas'
import '@xterm/xterm/css/xterm.css'
import { xtermTheme } from './xtermTheme'
import { useTerminalStore } from '@renderer/store/terminalStore'

/**
 * Loads the fastest renderer the GPU/driver will tolerate. WebGL is far
 * cheaper per-frame than the default DOM renderer for high-volume output;
 * canvas is the safe middle ground; DOM is the last resort. Either
 * accelerated addon can throw on context loss, so it self-heals by falling
 * back one tier rather than leaving the terminal blank.
 */
function loadFastestRenderer(term: XTerm): void {
  const tryCanvas = (): void => {
    try {
      term.loadAddon(new CanvasAddon())
    } catch {
      // fall back to the built-in DOM renderer
    }
  }
  try {
    const webgl = new WebglAddon()
    webgl.onContextLoss(() => {
      webgl.dispose()
      tryCanvas()
    })
    term.loadAddon(webgl)
  } catch {
    tryCanvas()
  }
}

interface TerminalPaneProps {
  id: string
  cwd: string
  shellPath?: string
  autoRun?: string
  fontSize: number
  active: boolean
}

export default function TerminalPane({
  id,
  cwd,
  shellPath,
  autoRun,
  fontSize,
  active
}: TerminalPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const updateTab = useTerminalStore((s) => s.updateTab)

  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false

    const term = new XTerm({
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 8000,
      theme: xtermTheme,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(new WebLinksAddon())

    term.open(containerRef.current)
    // fit() must run first so the terminal has real character/dimension
    // measurements before a GPU renderer addon attaches — loading WebGL/Canvas
    // before that leaves them reading undefined dimensions and throwing.
    fitAddon.fit()
    // Deferred + disposed-guarded: React StrictMode double-invokes this effect
    // in dev (mount → cleanup → mount), and the WebGL addon keeps an async
    // render loop running — without this guard, the throwaway first instance's
    // loop can fire after its own disposal and throw reading a torn-down core.
    requestAnimationFrame(() => {
      if (!disposed) loadFastestRenderer(term)
    })

    xtermRef.current = term
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    void window.api.pty.spawn({
      id,
      cwd,
      shell: shellPath,
      cols: term.cols,
      rows: term.rows,
      autoRun
    })

    const offData = window.api.pty.onData((evtId, data) => {
      if (evtId === id) term.write(data)
    })

    const offExit = window.api.pty.onExit((evt) => {
      if (evt.id === id) {
        updateTab(id, { isRunning: false, exitCode: evt.exitCode })
        term.write(`\r\n\x1b[2m[processo encerrado — código ${evt.exitCode}]\x1b[0m\r\n`)
      }
    })

    const dataDisposable = term.onData((data) => {
      void window.api.pty.write(id, data)
    })

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current) return
      try {
        fitAddon.fit()
        void window.api.pty.resize(id, term.cols, term.rows)
      } catch {
        // container may be mid-teardown
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      disposed = true
      resizeObserver.disconnect()
      dataDisposable.dispose()
      offData()
      offExit()
      term.dispose()
      void window.api.pty.kill(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (active && fitAddonRef.current && xtermRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit()
        if (xtermRef.current) {
          void window.api.pty.resize(id, xtermRef.current.cols, xtermRef.current.rows)
        }
        xtermRef.current?.focus()
      })
    }
  }, [active, id])

  useEffect(() => {
    xtermRef.current?.options && (xtermRef.current.options.fontSize = fontSize)
    fitAddonRef.current?.fit()
  }, [fontSize])

  return (
    <div
      className="h-full w-full px-3 py-2"
      style={{ display: active ? 'block' : 'none' }}
      onClick={() => xtermRef.current?.focus()}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
