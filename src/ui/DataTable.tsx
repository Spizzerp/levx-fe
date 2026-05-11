import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react'
import { type ReactNode } from 'react'

import { cn } from '@/lib/cn'

export const NUM_CELL =
  'text-right whitespace-nowrap font-mono text-xs uppercase tracking-normal text-ink'

export type SortDirection = 'asc' | 'desc'

export interface DataTableSort {
  key: string
  dir: SortDirection
}

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  headerClassName?: string
  cellClassName?: string
  render: (item: T, index: number) => ReactNode
  sortAccessor?: (item: T) => number | string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  gridCols: string
  gridColsWide?: string
  rowHeight?: string
  keyExtractor: (item: T, index: number) => string | number
  onRowClick?: (item: T, index: number) => void
  emptyMessage?: string
  sort?: DataTableSort | null
  onSortToggle?: (key: string) => void
}

export function DataTable<T>({
  columns,
  data,
  gridCols,
  gridColsWide,
  rowHeight = 'h-[68px]',
  keyExtractor,
  onRowClick,
  emptyMessage = '[ NO DATA ]',
  sort,
  onSortToggle,
}: DataTableProps<T>) {
  const rowGridClass = cn('grid items-center gap-4 px-4', gridCols, gridColsWide)

  const rowBaseClass = cn(
    'group border-line border-0 border-b border-l-2 border-l-transparent',
    rowHeight,
    'duration-short ease-levx transition-[background,border-left-color]',
    'hover:border-l-ink-strong hover:bg-white/[0.02]',
  )

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div
        className={cn(
          rowGridClass,
          'border-line-strong h-10 border-0 border-b bg-surface-1 rounded-t-2xl',
          'text-ink-dim font-mono text-tag uppercase',
        )}
      >
        {columns.map((col) => {
          if (!col.sortAccessor || !onSortToggle) {
            return (
              <span key={col.key} className={col.headerClassName}>
                {col.header}
              </span>
            )
          }

          const isActive = sort?.key === col.key
          const isRightAligned = col.headerClassName?.includes('text-right') ?? false

          return (
            <button
              key={col.key}
              type="button"
              onClick={() => onSortToggle(col.key)}
              className={cn(
                col.headerClassName,
                'flex items-center gap-1.5',
                isRightAligned && 'justify-end',
                'duration-short ease-levx transition-colors',
                isActive ? 'text-ink-strong' : 'text-ink-dim hover:text-ink-muted',
              )}
              aria-sort={
                isActive ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : 'none'
              }
            >
              <span>{col.header}</span>
              {isActive ? (
                sort?.dir === 'asc' ? (
                  <ChevronUp size={12} strokeWidth={1.75} aria-hidden />
                ) : (
                  <ChevronDown size={12} strokeWidth={1.75} aria-hidden />
                )
              ) : (
                <ChevronsUpDown size={12} strokeWidth={1.75} aria-hidden />
              )}
            </button>
          )
        })}
      </div>

      {/* Rows */}
      {data.length > 0
        ? data.map((item, idx) =>
            onRowClick ? (
              <button
                key={keyExtractor(item, idx)}
                type="button"
                onClick={() => onRowClick(item, idx)}
                className={cn(
                  rowGridClass,
                  rowBaseClass,
                  'cursor-pointer bg-transparent text-left',
                )}
              >
                {columns.map((col) => (
                  <span key={col.key} className={col.cellClassName}>
                    {col.render(item, idx)}
                  </span>
                ))}
              </button>
            ) : (
              <div key={keyExtractor(item, idx)} className={cn(rowGridClass, rowBaseClass)}>
                {columns.map((col) => (
                  <span key={col.key} className={col.cellClassName}>
                    {col.render(item, idx)}
                  </span>
                ))}
              </div>
            ),
          )
        : (
            <div className="text-ink-dim py-24 text-center font-mono text-label tracking-widest uppercase">
              <span>{emptyMessage}</span>
            </div>
          )}
    </div>
  )
}
