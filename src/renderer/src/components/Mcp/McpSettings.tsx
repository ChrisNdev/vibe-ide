import { useEffect, useState } from 'react'
import { Plug, Unplug } from 'lucide-react'
import { useExplorerStore } from '@renderer/store/explorerStore'
import SidePanel from '@renderer/components/ui/SidePanel'

interface McpSettingsProps {
  onClose: () => void
}

const TOOLS = ['get_project_graph', 'get_diagnostics', 'get_open_file', 'get_console_errors']

export default function McpSettings({ onClose }: McpSettingsProps): JSX.Element {
  const rootPath = useExplorerStore((s) => s.rootPath)
  const [installed, setInstalled] = useState(false)
  const [port, setPort] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!rootPath) return
    void window.api.mcp.status(rootPath).then((s) => {
      setInstalled(s.installed)
      setPort(s.port)
    })
  }, [rootPath])

  const install = async (): Promise<void> => {
    if (!rootPath) return
    setBusy(true)
    const result = await window.api.mcp.install(rootPath)
    setBusy(false)
    if (result.ok) {
      setInstalled(true)
      setStatus('Servidor MCP registrado em .mcp.json')
      void window.api.mcp.status(rootPath).then((s) => setPort(s.port))
    } else {
      setStatus(result.error ?? 'Falha ao instalar')
    }
  }

  const uninstall = async (): Promise<void> => {
    if (!rootPath) return
    setBusy(true)
    const result = await window.api.mcp.uninstall(rootPath)
    setBusy(false)
    if (result.ok) {
      setInstalled(false)
      setStatus('Entrada "vibeide" removida de .mcp.json')
    } else {
      setStatus(result.error ?? 'Falha ao desinstalar')
    }
  }

  return (
    <SidePanel title="Servidor MCP" icon={Plug} onClose={onClose} width={360}>
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
      {!rootPath && <div className="text-[12px] text-base-500">Abra uma pasta primeiro.</div>}

      {rootPath && (
        <>
          <div className="flex flex-col gap-2 rounded border border-base-700/60 p-2">
            <span className="text-[11px] text-base-400">
              Expõe o próprio vibeIDE como servidor MCP pro Claude no terminal — mapa de imports, diagnósticos, arquivo aberto e erros de
              console, sem gastar chamadas de <code className="text-base-300">Grep</code>. Registrado em{' '}
              <code className="text-base-300">.mcp.json</code>, merge não-destrutivo.
            </span>
            {port && <span className="tabular-nums text-[10px] text-base-500">porta local: {port}</span>}
            <button
              disabled={busy}
              onClick={() => void (installed ? uninstall() : install())}
              className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium disabled:opacity-40 ${
                installed ? 'bg-danger/15 text-danger hover:bg-danger/25' : 'bg-accent text-base-950 hover:bg-accent-bright'
              }`}
            >
              {installed ? <Unplug size={13} /> : <Plug size={13} />}
              {installed ? 'Desinstalar' : 'Instalar servidor MCP'}
            </button>
            {status && <span className="text-[11px] text-base-500">{status}</span>}
          </div>

          <div className="flex flex-col gap-1 border-t border-rule pt-3 text-[11px]">
            <span className="mb-1 font-medium uppercase tracking-wide text-base-500">Ferramentas expostas</span>
            {TOOLS.map((t) => (
              <span key={t} className="font-mono text-base-400">
                {t}
              </span>
            ))}
          </div>
        </>
      )}
      </div>
    </SidePanel>
  )
}
