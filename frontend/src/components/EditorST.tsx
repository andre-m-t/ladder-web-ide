/** Caixa de texto multilinha para o Structured Text (RF-1). */
interface EditorSTProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function EditorST({ value, onChange, disabled = false }: EditorSTProps) {
  return (
    <div>
      <label htmlFor="editor-st" className="block text-sm font-medium text-slate-700">
        Structured Text (ST)
      </label>
      <textarea
        id="editor-st"
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        disabled={disabled}
        spellCheck={false}
        rows={20}
        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </div>
  )
}
