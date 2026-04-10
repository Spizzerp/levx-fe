interface StubProps {
  title: string
  subtitle?: string
}

export function Stub({ title, subtitle }: StubProps) {
  return (
    <div className="flex min-h-[calc(100vh-200px)] flex-col items-center justify-center gap-3 px-8 py-24">
      <div className="text-ink-muted font-mono text-[11px] tracking-[0.14em] uppercase">
        {title}
      </div>
      {subtitle && (
        <div className="text-ink-dim font-mono text-[11px] tracking-[0.1em] uppercase">
          {subtitle}
        </div>
      )}
    </div>
  )
}
