import { useState } from 'react'
import { Palette, ImagePlus, RotateCcw, Download, Upload, Trash2 } from 'lucide-react'
import { useBackgroundStore } from '@renderer/store/backgroundStore'
import SidePanel from '@renderer/components/ui/SidePanel'
import { PRESETS } from './presets'
import type { BackgroundKind } from '@shared/types'

interface BackgroundSettingsProps {
  onClose: () => void
}

const KIND_LABEL: Record<BackgroundKind, string> = {
  none: 'Nenhum',
  image: 'Imagem',
  gradient: 'Gradiente',
  solid: 'Sólido',
  procedural: 'Preset'
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-base-400">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-base-300">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-ink-magenta"
      />
    </label>
  )
}

export default function BackgroundSettings({ onClose }: BackgroundSettingsProps): JSX.Element {
  const config = useBackgroundStore((s) => s.config)
  const setConfig = useBackgroundStore((s) => s.setConfig)
  const pickImage = useBackgroundStore((s) => s.pickImage)
  const removeBackground = useBackgroundStore((s) => s.removeBackground)
  const selectPreset = useBackgroundStore((s) => s.selectPreset)
  const resetToDefault = useBackgroundStore((s) => s.resetToDefault)
  const exportTheme = useBackgroundStore((s) => s.exportTheme)
  const importTheme = useBackgroundStore((s) => s.importTheme)
  const contrastNotice = useBackgroundStore((s) => s.contrastNotice)

  const [themeName, setThemeName] = useState('meu-tema')
  const [status, setStatus] = useState<string | null>(null)
  const isWindows = window.api.platform === 'win32'

  const runExport = async (): Promise<void> => {
    const result = await exportTheme(themeName)
    setStatus(result.ok ? `Exportado: ${result.path}` : result.error ?? 'Falha ao exportar')
  }

  const runImport = async (): Promise<void> => {
    const result = await importTheme()
    setStatus(result.ok ? 'Tema importado.' : result.error ?? 'Falha ao importar')
  }

  return (
    <SidePanel title="Aparência" icon={Palette} onClose={onClose} width={340}>
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
      {contrastNotice && (
        <div className="rounded border border-ink-yellow/50 bg-ink-yellow/10 px-2 py-1.5 text-[11px] text-ink-yellow">
          {contrastNotice}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-base-500">Fundo</span>
        <div className="flex flex-wrap gap-1">
          {(['none', 'image', 'gradient', 'solid'] as BackgroundKind[]).map((kind) => (
            <button
              key={kind}
              onClick={() => (kind === 'image' ? void pickImage() : void setConfig({ kind, proceduralId: null }))}
              className={`rounded px-2 py-1 text-[11px] ${
                config.kind === kind ? 'bg-ink-magenta text-base-950' : 'bg-base-800 text-base-300 hover:bg-base-700/60'
              }`}
            >
              {KIND_LABEL[kind]}
            </button>
          ))}
          <button
            onClick={() => void pickImage()}
            className="flex items-center gap-1 rounded bg-base-800 px-2 py-1 text-[11px] text-base-300 hover:bg-base-700/60"
            title="Escolher imagem"
          >
            <ImagePlus size={12} />
            Escolher…
          </button>
        </div>

        {config.kind === 'gradient' && (
          <div className="flex items-center gap-2 pt-1">
            <input type="color" value={config.gradientFrom} onChange={(e) => void setConfig({ gradientFrom: e.target.value })} />
            <input type="color" value={config.gradientTo} onChange={(e) => void setConfig({ gradientTo: e.target.value })} />
          </div>
        )}
        {config.kind === 'solid' && (
          <div className="pt-1">
            <input type="color" value={config.solidColor} onChange={(e) => void setConfig({ solidColor: e.target.value })} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-base-500">Presets</span>
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => void selectPreset(p.id)}
              className={`rounded px-2 py-1 text-[11px] ${
                config.proceduralId === p.id || (p.id === 'solid' && config.kind === 'solid' && !config.proceduralId)
                  ? 'bg-ink-magenta text-base-950'
                  : 'bg-base-800 text-base-300 hover:bg-base-700/60'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-rule pt-3">
        <Slider label="Blur" value={config.blur} min={0} max={48} step={1} onChange={(v) => void setConfig({ blur: v })} />
        <Slider
          label="Brilho"
          value={config.brightness}
          min={0.3}
          max={1.7}
          step={0.05}
          onChange={(v) => void setConfig({ brightness: v })}
        />
        <Slider
          label="Saturação"
          value={config.saturation}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => void setConfig({ saturation: v })}
        />
        <Slider label="Opacidade do véu" value={config.veil} min={0} max={1} step={0.01} onChange={(v) => void setConfig({ veil: v })} />
        <Slider
          label="Opacidade das superfícies"
          value={config.surfaceAlpha}
          min={0.3}
          max={1}
          step={0.01}
          onChange={(v) => void setConfig({ surfaceAlpha: v })}
        />
        <label className="flex items-center justify-between text-[11px] text-base-400">
          <span>Cor spot</span>
          <input type="color" value={config.spot} onChange={(e) => void setConfig({ spot: e.target.value })} />
        </label>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-rule pt-3 text-[11px]">
        <label className="flex items-center justify-between text-base-400" title="Sempre ligada — garante 4.5:1 de contraste pro texto sobre qualquer fundo">
          <span>Contraste garantido</span>
          <input type="checkbox" checked disabled />
        </label>
        <label className="flex items-center justify-between text-base-400">
          <span>Terminal translúcido (renderer Canvas, pode ficar mais lento)</span>
          <input
            type="checkbox"
            checked={config.terminalTranslucent}
            onChange={(e) => void setConfig({ terminalTranslucent: e.target.checked })}
          />
        </label>
        {isWindows && (
          <label className="flex items-center justify-between text-base-400">
            <span>Usar papel de parede do sistema</span>
            <input
              type="checkbox"
              checked={config.useSystemWallpaper}
              onChange={(e) => void setConfig({ useSystemWallpaper: e.target.checked })}
            />
          </label>
        )}
      </div>

      <button
        onClick={() => void resetToDefault()}
        className="flex items-center justify-center gap-1.5 rounded bg-base-800 px-2 py-1.5 text-[11px] text-base-300 hover:bg-base-700/60"
      >
        <RotateCcw size={12} />
        Restaurar padrão
      </button>

      <div className="flex flex-col gap-1.5 border-t border-rule pt-3">
        <span className="text-[11px] font-medium uppercase tracking-wide text-base-500">Tema</span>
        <input
          value={themeName}
          onChange={(e) => setThemeName(e.target.value)}
          className="rounded border border-base-700/60 bg-base-900 px-2 py-1 text-[12px] outline-none focus:border-ink-yellow"
          placeholder="nome-do-tema"
        />
        <div className="flex gap-1.5">
          <button
            onClick={() => void runExport()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded bg-base-800 px-2 py-1.5 text-[11px] text-base-300 hover:bg-base-700/60"
          >
            <Download size={12} />
            Exportar
          </button>
          <button
            onClick={() => void runImport()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded bg-base-800 px-2 py-1.5 text-[11px] text-base-300 hover:bg-base-700/60"
          >
            <Upload size={12} />
            Importar
          </button>
        </div>
        {status && <span className="truncate text-[10px] text-base-500" title={status}>{status}</span>}
      </div>

      {config.kind !== 'none' && (
        <button
          onClick={() => void removeBackground()}
          className="flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] text-danger hover:bg-danger/10"
        >
          <Trash2 size={12} />
          Remover fundo
        </button>
      )}
      </div>
    </SidePanel>
  )
}
