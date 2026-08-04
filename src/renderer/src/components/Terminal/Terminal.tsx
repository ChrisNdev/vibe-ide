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
import { useBackgroundStore } from '@renderer/store/backgroundStore'

/**
 * Loads the fastest renderer the GPU/driver will tolerate. WebGL is far
 * cheaper per-frame than the default DOM renderer for high-volume output;
 * canvas is the safe middle ground; DOM is the last resort. Either
 * accelerated addon can throw on context loss, so it self-heals by falling
 * back one tier rather than leaving the terminal blank.
 *
 * preferCanvas is the ONLY thing the "terminal translúcido" setting changes here:
 * it skips straight to Canvas instead of WebGL. It does NOT enable
 * allowTransparency — INVARIANTES forbids that unconditionally, on either
 * renderer — so the canvas paints solid pixels either way. Canvas is just the
 * renderer the setting names in docs/PLANO.md; it's still fully opaque.
 */
function loadFastestRenderer(term: XTerm, preferCanvas: boolean): void {
  const tryCanvas = (): void => {
    try {
      term.loadAddon(new CanvasAddon())
    } catch {
      // fall back to the built-in DOM renderer
    }
  }
  if (preferCanvas) {
    tryCanvas()
    return
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

/**
 * Ctrl+C copies the selection (matches VS Code/Windows Terminal); with nothing selected it
 * falls through to xterm's default handling, which sends the raw byte — SIGINT, same as always.
 * Ctrl+V pastes — xterm doesn't bind that key to anything by default. An image on the clipboard
 * can't be dropped into a terminal grid, so it's saved to a temp PNG and pasted as a path instead
 * (Claude Code CLI already treats an image path in the prompt as an attachment).
 */
function attachClipboardKeys(term: XTerm): void {
  term.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown' || event.altKey) return true
    const mod = event.ctrlKey || event.metaKey
    if (!mod) return true

    if (event.key.toLowerCase() === 'c' && !event.shiftKey && term.hasSelection()) {
      void navigator.clipboard.writeText(term.getSelection())
      return false
    }
    if (event.key.toLowerCase() === 'v' && !event.shiftKey) {
      void window.api.clipboard.readImageOrText().then((result) => {
        if (result.kind === 'image') term.paste(result.path)
        else if (result.kind === 'text') term.paste(result.text)
      })
      return false
    }
    return true
  })
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
  const hasBackground = useBackgroundStore((s) => s.config.kind !== 'none')
  const terminalBg = useBackgroundStore((s) => s.terminalBackgroundHex())

  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false

    // Read once at mount via getState() (not the reactive hook) — this effect only
    // runs on [id], same as fontSize below; live background changes are applied by
    // the separate effect further down instead of recreating the terminal/pty.
    const bg = useBackgroundStore.getState()
    const initialTheme = bg.config.kind !== 'none' ? { ...xtermTheme, background: bg.terminalBackgroundHex(), cursorAccent: bg.terminalBackgroundHex() } : xtermTheme

    const term = new XTerm({
      fontFamily: '"Commit Mono", ui-monospace, monospace',
      fontSize,
      lineHeight: 1.35,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 8000,
      theme: initialTheme,
      allowProposedApi: true
      // allowTransparency intentionally omitted (defaults to false) — INVARIANTES:
      // never enable it on the terminal, on either renderer.
    })

    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(searchAddon)
    term.loadAddon(new WebLinksAddon())
    attachClipboardKeys(term)

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
      if (!disposed) loadFastestRenderer(term, bg.config.terminalTranslucent)
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

  // Live theme update when the background config changes — mutates the running
  // terminal's options instead of recreating it (which would kill the pty).
  useEffect(() => {
    if (!xtermRef.current) return
    xtermRef.current.options.theme = hasBackground ? { ...xtermTheme, background: terminalBg, cursorAccent: terminalBg } : xtermTheme
  }, [hasBackground, terminalBg])

  return (
    <div
      className="surface-tint h-full w-full px-3 py-2"
      style={{ display: active ? 'block' : 'none' }}
      onClick={() => xtermRef.current?.focus()}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
