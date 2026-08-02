import { useState } from 'react'
import { DownloadCloud, Loader2 } from 'lucide-react'
import type { UpdateCheckResult } from '@shared/types'

export default function UpdateChecker(): JSX.Element {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)

  const handleClick = async (): Promise<void> => {
    if (result?.hasUpdate && result.releaseUrl) {
      void window.api.app.openExternal(result.releaseUrl)
      return
    }
    if (checking) return
    setChecking(true)
    try {
      setResult(await window.api.app.checkForUpdate())
    } finally {
      setChecking(false)
    }
  }

  const label = checking
    ? 'verificando…'
    : result?.error
      ? 'gh não encontrado'
      : result?.hasUpdate
        ? `v${result.latestVersion} disponível`
        : result
          ? 'atualizado'
          : 'verificar atualização'

  const title = result?.error
    ? 'Não consegui checar (precisa do GitHub CLI logado)'
    : result?.hasUpdate
      ? 'Abrir página da nova versão'
      : `Verificar atualizações no repositório ${'ChrisNdev/vibe-ide'}`

  return (
    <button
      onClick={handleClick}
      title={title}
      className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] ${
        result?.hasUpdate
          ? 'bg-accent-muted text-accent'
          : 'text-base-400 hover:bg-base-700/60 hover:text-base-200'
      }`}
    >
      {checking ? <Loader2 size={12} className="animate-spin" /> : <DownloadCloud size={12} />}
      {label}
    </button>
  )
}
