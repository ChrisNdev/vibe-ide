import { useState } from 'react'
import { DownloadCloud, Loader2, RotateCw } from 'lucide-react'
import type { UpdateCheckResult } from '@shared/types'

export default function UpdateChecker(): JSX.Element {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installError, setInstallError] = useState<string | null>(null)

  const handleCheck = async (): Promise<void> => {
    if (checking) return
    setChecking(true)
    setInstallError(null)
    try {
      setResult(await window.api.app.checkForUpdate())
    } finally {
      setChecking(false)
    }
  }

  const handleInstall = async (): Promise<void> => {
    if (!result?.latestTag || installing) return
    setInstalling(true)
    setInstallError(null)
    const res = await window.api.app.installUpdate(result.latestTag)
    if (!res.ok) {
      setInstallError(res.error ?? 'Falha ao atualizar')
      setInstalling(false)
    }
    // on success the app quits itself in a moment to relaunch already updated — nothing else to do
  }

  if (installing) {
    return (
      <span className="flex items-center gap-1.5 rounded bg-accent-muted px-2 py-1 text-[11px] text-accent">
        <Loader2 size={12} className="animate-spin" />
        Atualizando… o app vai fechar e reabrir sozinho
      </span>
    )
  }

  if (result?.hasUpdate) {
    return (
      <div className="flex items-center gap-1.5">
        {installError && (
          <span className="max-w-[220px] truncate text-[11px] text-danger" title={installError}>
            {installError}
          </span>
        )}
        <button
          onClick={handleInstall}
          title="Baixa e instala a atualização automaticamente, e reabre o app"
          className="flex items-center gap-1.5 rounded bg-accent px-2 py-1 text-[11px] font-medium text-base-950 hover:bg-accent-bright"
        >
          <DownloadCloud size={12} />
          Atualizar para v{result.latestVersion}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleCheck}
      title="Verificar atualizações no repositório ChrisNdev/vibe-ide"
      className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px] text-base-400 hover:bg-base-700/60 hover:text-base-200"
    >
      {checking ? (
        <Loader2 size={12} className="animate-spin" />
      ) : result?.error ? (
        <DownloadCloud size={12} />
      ) : (
        <RotateCw size={12} />
      )}
      {checking ? 'verificando…' : result?.error ? 'gh não encontrado' : result ? 'atualizado' : 'verificar atualização'}
    </button>
  )
}
