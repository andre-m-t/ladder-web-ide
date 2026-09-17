/** Caixa de texto multilinha para o Structured Text (RF-1). */
interface EditorSTProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function EditorST({ value, onChange, disabled = false }: EditorSTProps) {
  return (
    <div className="flex h-full flex-col">
      <label htmlFor="editor-st" className="block text-sm font-medium text-ide-suave">
        Structured Text (ST)
      </label>
      <textarea
        id="editor-st"
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        disabled={disabled}
        spellCheck={false}
        className="mt-1 block w-full flex-1 resize-none rounded-lg border border-ide-borda bg-ide-painel p-3 font-mono text-sm text-ide-texto shadow-sm focus:border-ide-destaque focus:outline-none focus:ring-1 focus:ring-ide-destaque disabled:bg-ide-elevado disabled:text-ide-suave"
      />
    </div>
  )
}
