/**
 * Mounts a single `ProgramEventStream` for the life of the app and
 * wires the default React-Query invalidation listener. Component-level
 * subscriptions read the stream out of context via `useEventStream`
 * (see `useProgramEvents.ts`).
 */

import { useEffect, useState, type ReactNode } from 'react'
import { useConnection } from '@solana/wallet-adapter-react'
import { useQueryClient } from '@tanstack/react-query'
import { PublicKey } from '@solana/web3.js'

import idlJson from '@/idl/levx.json'
import type { Idl } from '@coral-xyz/anchor'
import { ProgramEventStream } from './events'
import { EventStreamContext } from './eventStreamContext'
import { dispatchEventInvalidation } from '@/lib/api/eventInvalidation'

const PROGRAM_ID = new PublicKey(idlJson.address)

export function EventStreamProvider({ children }: { children: ReactNode }) {
  const { connection } = useConnection()
  const queryClient = useQueryClient()
  const [stream, setStream] = useState<ProgramEventStream | null>(null)

  useEffect(() => {
    // Constructing the stream calls `connection.onLogs` (a side effect),
    // so it has to live in the effect — not a useState lazy initializer.
    // The setState here is the canonical way to publish the new instance
    // to consumers; it triggers exactly one extra render on mount, which
    // is the cost of doing the WS subscription correctly.
    const s = new ProgramEventStream(connection, PROGRAM_ID, idlJson as Idl)
    const unregister = s.addListener((event) => {
      dispatchEventInvalidation(queryClient, event)
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStream(s)
    return () => {
      unregister()
      void s.dispose()
    }
  }, [connection, queryClient])

  return <EventStreamContext.Provider value={stream}>{children}</EventStreamContext.Provider>
}
