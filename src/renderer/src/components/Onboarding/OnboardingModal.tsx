import { useEffect, useRef } from 'react'
import { TerminalSquare, Waypoints, Eye, Activity, FlaskConical, Search, MoreHorizontal } from 'lucide-react'

interface OnboardingModalProps {
  onClose: () => void
}

const STEPS = [
  {
    icon: TerminalSquare,
    title: 'Terminal',
    text: 'É aqui que você conversa com o Claude. Digite o que você quer que ele faça, em português mesmo — ele lê e escreve o código.'
  },
  {
    icon: Waypoints,
    title: 'Mapa mental',
    text: 'Mostra visualmente como os arquivos do seu projeto se conectam entre si. Não precisa entender código pra ver o tamanho e a forma do projeto.'
  },
  {
    icon: Eye,
    title: 'Visualizador',
    text: 'Clica num arquivo na lista à esquerda e o conteúdo aparece aqui — só pra ler, sem gastar nada com o Claude.'
  },
  {
    icon: Activity,
    title: 'Atividade',
    text: 'Acompanha o que o Claude está fazendo agora — quais arquivos ele mexeu, e quanto isso custou até aqui.'
  },
  {
    icon: FlaskConical,
    title: 'Verificação',
    text: 'Roda o projeto e mostra se funcionou, com os erros já formatados — dá pra mandar direto pro Claude corrigir.'
  },
  {
    icon: Search,
    title: 'Buscar',
    text: 'Procura um texto em todos os arquivos do projeto de uma vez.'
  },
  {
    icon: MoreHorizontal,
    title: 'Mais opções',
    text: 'Funções mais avançadas ficam guardadas aqui — aparência, notificações, pontos de restauração e mais.'
  }
]

export default function OnboardingModal({ onClose }: OnboardingModalProps): JSX.Element {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-substrate/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="surface flex max-h-[80vh] w-[520px] flex-col overflow-hidden rounded-2xl border border-base-700/60 text-base-200 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-2 border-b border-base-700/60 px-6 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-muted">
            <Waypoints size={22} className="text-accent" />
          </div>
          <span className="text-[16px] font-semibold text-base-100">Bem-vindo ao vibeIDE</span>
          <span className="text-[13px] text-base-400">Um guia rápido do que cada botão faz</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {STEPS.map((step) => (
            <div key={step.title} className="flex items-start gap-3 rounded-xl px-3.5 py-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-base-800/70">
                <step.icon size={15} className="text-accent" />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-base-100">{step.title}</div>
                <div className="text-[12px] leading-relaxed text-base-400">{step.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-base-700/60 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-full bg-accent px-4 py-1.5 text-[12px] font-medium text-white transition-colors duration-150 ease-apple hover:bg-accent-bright"
          >
            Entendi, vamos lá
          </button>
        </div>
      </div>
    </div>
  )
}
