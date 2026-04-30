import { createContext, useContext } from 'react'

import type { ProgramEventStream } from './events'

/**
 * Context plumbing for the program-wide event stream singleton.
 *
 * Lives in its own file so `react-refresh/only-export-components` is
 * happy with `EventStreamProvider.tsx` (which exports only the
 * component) and `useEventStream.ts` / `useProgramEvents.ts` can
 * import the bare hook without dragging the JSX module into HMR
 * boundaries.
 */
export const EventStreamContext = createContext<ProgramEventStream | null>(null)

export function useEventStream(): ProgramEventStream | null {
  return useContext(EventStreamContext)
}
