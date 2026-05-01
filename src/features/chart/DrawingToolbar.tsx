import { useEffect } from 'react'
import { PenTool, Pencil, Slash } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useDrawingStore } from '@/stores/drawingStore'
import type { ToolId } from '@/lib/drawing/types'

interface ToolDef {
  id: ToolId
  label: string
  shortcut: string
  Icon: typeof Pencil
}

const TOOLS: ToolDef[] = [
  { id: 'freehand', label: 'Freehand', shortcut: 'F', Icon: Pencil },
  { id: 'line', label: 'Line', shortcut: 'L', Icon: Slash },
  { id: 'bezier', label: 'Bezier', shortcut: 'B', Icon: PenTool },
]

export interface DrawingToolbarProps {
  /** Pixel offset from the chart wrap's top edge — typically chart MARGIN.top + padding. */
  top: number
  /** Pixel offset from the chart wrap's right edge — typically chart MARGIN.right + padding. */
  right: number
}

/**
 * Floating drawing toolbar — anchored to the chart's inner-area top-right corner.
 *
 * Renders nothing while the drawing store is idle so the chart stays uncluttered
 * outside of draw mode.
 */
export function DrawingToolbar({ top, right }: DrawingToolbarProps) {
  const phase = useDrawingStore((s) => s.state.phase)
  const activeTool = useDrawingStore((s) => s.activeTool)
  const setActiveTool = useDrawingStore((s) => s.setActiveTool)

  // Keyboard shortcuts — listener is window-scoped but only mounts while in
  // draw mode (component returns null when idle), so it cannot intercept
  // keystrokes outside the drawing context.
  //
  // - Cmd/Ctrl+Z → undo
  // - Cmd/Ctrl+Shift+Z or Ctrl+Y → redo
  // - F → freehand tool, L → line tool
  useEffect(() => {
    if (phase === 'idle') return
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      const mod = e.ctrlKey || e.metaKey
      const isZ = e.key === 'z' || e.key === 'Z'
      const isY = e.key === 'y' || e.key === 'Y'

      if (mod && isZ) {
        e.preventDefault()
        if (e.shiftKey) {
          useDrawingStore.getState().redo()
        } else {
          useDrawingStore.getState().undo()
        }
        return
      }
      if (mod && isY && !e.shiftKey) {
        e.preventDefault()
        useDrawingStore.getState().redo()
        return
      }

      // Single-key tool shortcuts — no Ctrl/Cmd/Alt modifiers.
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'f' || e.key === 'F') {
        useDrawingStore.getState().setActiveTool('freehand')
      } else if (e.key === 'l' || e.key === 'L') {
        useDrawingStore.getState().setActiveTool('line')
      } else if (e.key === 'b' || e.key === 'B') {
        useDrawingStore.getState().setActiveTool('bezier')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase])

  if (phase === 'idle') return null

  return (
    <div
      data-testid="drawing-toolbar"
      style={{ top, right }}
      className={cn(
        'absolute z-10 flex flex-col gap-1 rounded-lg p-1',
        'border-line-strong bg-surface/80 border backdrop-blur-sm',
      )}
    >
      {TOOLS.map(({ id, label, shortcut, Icon }) => {
        const isActive = activeTool === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTool(id)}
            data-testid={`drawing-tool-${id}`}
            data-active={isActive ? 'true' : 'false'}
            title={`${label} (${shortcut})`}
            aria-label={label}
            aria-pressed={isActive}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-md',
              'duration-short ease-levx transition-colors',
              isActive
                ? 'bg-line-strong text-ink-strong'
                : 'text-ink-muted hover:bg-line hover:text-ink-strong',
            )}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
