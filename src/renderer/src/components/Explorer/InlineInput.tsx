import { useEffect, useRef } from 'react'

interface InlineInputProps {
  initialValue: string
  indent: number
  onSubmit: (value: string) => void
  onCancel: () => void
}

export default function InlineInput({ initialValue, indent, onSubmit, onCancel }: InlineInputProps): JSX.Element {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const dot = initialValue.lastIndexOf('.')
    el.setSelectionRange(0, dot > 0 ? dot : initialValue.length)
  }, [initialValue])

  return (
    <div className="flex items-center gap-1.5 py-0.5 pr-2" style={{ paddingLeft: indent }}>
      <input
        ref={ref}
        defaultValue={initialValue}
        spellCheck={false}
        className="w-full rounded border border-accent/50 bg-base-900 px-1 py-0.5 text-[13px] text-base-100 outline-none focus:border-accent"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const value = e.currentTarget.value.trim()
            if (value) onSubmit(value)
            else onCancel()
          } else if (e.key === 'Escape') {
            onCancel()
          }
          e.stopPropagation()
        }}
        onBlur={(e) => {
          const value = e.currentTarget.value.trim()
          if (value && value !== initialValue) onSubmit(value)
          else onCancel()
        }}
      />
    </div>
  )
}
