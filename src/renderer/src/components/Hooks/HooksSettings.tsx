import { useEffect, useState } from 'react'
import { X, Bell, Plug, Unplug } from 'lucide-react'
import { useExplorerStore } from '@renderer/store/explorerStore'
import type { AppSettings } from '@shared/types'

interface HooksSettingsProps {
  onClose: () => void
}

export default function HooksSettings({ onClose }: HooksSettingsProps): JSX.Element {
  const rootPath = useExplorerStore((s) => s.rootPath)
  const [installed, setInstalled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<AppSettings['notifications'] | null>(null)

  useEffect(() => {
    if (!rootPath) return
    void window.api.hooks.status(rootPath).then((s) => setInstalled(s.installed))
    void window.api.settings.get().then((s) => setNotifications(s.notifications))
  }, [rootPath])

  const install = async (): Promise<void> => {
    if (!rootPath) return
    setBusy(true)
    const result = await window.api.hooks.install(rootPath)
    setBusy(false)
    if (result.ok) {
      setInstalled(true)
      setStatus('Hooks instalados em .claude/settings.local.json')
    } else {
      setStatus(result.error ?? 'Falha ao instalar')
    }
  }

  const uninstall = async (): Promise<void> => {
    if (!rootPath) return
    setBusy(true)
    const result = await window.api.hooks.uninstall(rootPath)
    setBusy(false)
    if (result.ok) {
      setInstalled(false)
      setStatus('Hooks desinstalados — settings.local.json restaurado')
    } else {
      setStatus(result.error ?? 'Falha ao desinstalar')
    }
  }

  const updateNotifications = (patch: Partial<AppSettings['notifications']>): void => {
    if (!notifications) return
    const next = { ...notifications, ...patch }
    setNotifications(next)
    void window.api.settings.set({ notifications: next })
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-[340px] flex-col gap-4 overflow-y-auto border-l border-rule bg-panel p-3 text-base-200 animate-slide-up">
      <div className="flex items-center justify-between">
        <span className="font-medium text-base-100">Hooks e notificações</span>
        <button className="rounded p-1 text-base-400 hover:bg-base-700/60" onClick={onClose} title="Fechar">
          <X size={14} />
        </button>
      </div>

      {!rootPath && <div className="text-[12px] text-base-500">Abra uma pasta primeiro.</div>}

      {rootPath && (
        <>
          <div className="flex flex-col gap-2 rounded border border-base-700/60 p-2">
            <span className="text-[11px] text-base-400">
              Instala <code className="text-base-300">UserPromptSubmit</code>, <code className="text-base-300">Stop</code> e{' '}
              <code className="text-base-300">Notification</code> em <code className="text-base-300">.claude/settings.local.json</code> —
              merge não-destrutivo, com backup. Desinstalar restaura o arquivo exatamente como estava.
            </span>
            <button
              disabled={busy}
              onClick={() => void (installed ? uninstall() : install())}
              className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium disabled:opacity-40 ${
                installed ? 'bg-danger/15 text-danger hover:bg-danger/25' : 'bg-accent text-base-950 hover:bg-accent-bright'
              }`}
            >
              {installed ? <Unplug size={13} /> : <Plug size={13} />}
              {installed ? 'Desinstalar hooks' : 'Instalar hooks'}
            </button>
            {status && <span className="text-[11px] text-base-500">{status}</span>}
          </div>

          {notifications && (
            <div className="flex flex-col gap-1.5 border-t border-rule pt-3 text-[11px]">
              <div className="mb-1 flex items-center gap-1.5 text-base-400">
                <Bell size={12} />
                <span className="font-medium uppercase tracking-wide">Notificações</span>
              </div>
              <label className="flex items-center justify-between text-base-400">
                <span>Notificar em Stop / Notification (só se a janela não estiver em foco)</span>
                <input type="checkbox" checked={notifications.enabled} onChange={(e) => updateNotifications({ enabled: e.target.checked })} />
              </label>
              <label className="flex items-center justify-between text-base-400">
                <span>Som</span>
                <input
                  type="checkbox"
                  checked={notifications.sound}
                  disabled={!notifications.enabled}
                  onChange={(e) => updateNotifications({ sound: e.target.checked })}
                />
              </label>
            </div>
          )}
        </>
      )}
    </div>
  )
}
