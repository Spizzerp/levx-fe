import { X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { explorerTxUrl } from '@/lib/format'
import { useToastStore, type Toast } from '@/stores/toastStore'

const TYPE_DOT: Record<Toast['type'], string> = {
  success: 'bg-success',
  error: 'bg-accent',
  info: 'bg-ink-muted',
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div
      className={cn(
        'pill-glow relative flex items-start gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3',
        'animate-[slideIn_200ms_ease-out]',
      )}
    >
      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TYPE_DOT[toast.type])} />
      <div className="flex-1 min-w-0">
        <p className="text-ink-strong font-mono text-label uppercase tracking-wide">
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-ink-muted font-mono text-caption mt-0.5 tracking-wide line-clamp-3">
            {toast.message}
          </p>
        )}
        {toast.txSig && (
          <a
            href={explorerTxUrl(toast.txSig)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-interactive font-mono text-label mt-1 block truncate tracking-wide hover:underline"
          >
            View on Explorer
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="text-ink-dim hover:text-ink shrink-0 p-0.5"
      >
        <X size={12} strokeWidth={1.5} />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-toast flex w-96 flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
