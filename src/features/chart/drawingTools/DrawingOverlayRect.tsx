import { forwardRef } from 'react'
import type { CSSProperties, PointerEventHandler } from 'react'

export interface DrawingOverlayRectProps {
  x: number
  y?: number
  width: number
  height: number
  /**
   * Static cursor for the rect. Omit when the tool mutates the cursor
   * directly via a ref (SelectTool) so React re-renders don't clobber it.
   */
  cursor?: CSSProperties['cursor']
  /** Used by tests — `data-tool="bezier"` etc. Omitted for the freehand tool. */
  dataTool?: string
  onPointerDown?: PointerEventHandler<SVGRectElement>
  onPointerMove?: PointerEventHandler<SVGRectElement>
  onPointerUp?: PointerEventHandler<SVGRectElement>
  onPointerCancel?: PointerEventHandler<SVGRectElement>
  onLostPointerCapture?: PointerEventHandler<SVGRectElement>
}

/**
 * Pointer-receiving overlay rect shared by every drawing tool.
 *
 * Each tool used to inline this rect with the same `fill="transparent"`,
 * `touchAction: 'none'`, and `data-testid="drawing-overlay"` boilerplate;
 * extracting it here keeps the tools focused on their per-tool logic.
 */
export const DrawingOverlayRect = forwardRef<SVGRectElement, DrawingOverlayRectProps>(
  function DrawingOverlayRect(
    {
      x,
      y = 0,
      width,
      height,
      cursor,
      dataTool,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
    },
    ref,
  ) {
    const style: CSSProperties = cursor === undefined
      ? { touchAction: 'none' }
      : { touchAction: 'none', cursor }
    return (
      <rect
        ref={ref}
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
        data-testid="drawing-overlay"
        data-tool={dataTool}
      />
    )
  },
)
