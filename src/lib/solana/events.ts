/**
 * Single program-wide WebSocket subscription via `connection.onLogs`,
 * decoded through Anchor's `BorshEventCoder` and dispatched to in-process
 * listeners.
 *
 * Architecture choice: Helius's enhanced `transactionSubscribe` (used by
 * the keeper) requires a Geyser-tier API key the FE doesn't ship. Stock
 * `onLogs` is enough — the keeper handles the firehose work, and the FE
 * only needs invalidation triggers off events that touch the user's
 * current view.
 *
 * The `Connection` object handles WebSocket reconnects internally and
 * re-subscribes on reconnect, so this module deliberately stays thin —
 * we don't reimplement that logic.
 */

import { BorshEventCoder, type Idl } from '@coral-xyz/anchor'
import { Connection, PublicKey } from '@solana/web3.js'

const PROGRAM_DATA_PREFIX = 'Program data: '

export interface ProgramEvent<T = unknown> {
  /** PascalCase event name, matches IDL (e.g. "WagerPlaced"). */
  name: string
  /** Decoded payload — fields are camelCase per Anchor convention. */
  data: T
  /** Tx signature the event was emitted in. */
  signature: string
}

export type EventListener<T = unknown> = (event: ProgramEvent<T>) => void

/**
 * Singleton-style event stream for a single program. Mount one of these
 * at the React tree root (see `EventStreamProvider`); component-level
 * subscriptions go through `addListener`.
 */
export class ProgramEventStream {
  private readonly connection: Connection
  private readonly programId: PublicKey
  private readonly coder: BorshEventCoder
  private readonly listeners = new Set<EventListener>()
  private subscriptionId: number | null = null
  private disposed = false

  constructor(connection: Connection, programId: PublicKey, idl: Idl) {
    this.connection = connection
    this.programId = programId
    this.coder = new BorshEventCoder(idl)
    this.subscriptionId = this.connection.onLogs(
      this.programId,
      (logs) => this.handleLogs(logs),
      'confirmed',
    )
  }

  private handleLogs(logs: { logs: string[]; signature: string; err: unknown }) {
    if (logs.err) return
    for (const line of logs.logs ?? []) {
      if (!line.startsWith(PROGRAM_DATA_PREFIX)) continue
      const dataStr = line.slice(PROGRAM_DATA_PREFIX.length)
      let decoded: { name: string; data: unknown } | null = null
      try {
        decoded = this.coder.decode(dataStr)
      } catch {
        continue
      }
      if (!decoded) continue
      // Anchor's BorshEventCoder returns names with a lowercase first
      // character (e.g. "wagerPlaced"); the IDL — and our invalidation
      // map — uses PascalCase. Normalize so listeners can match by IDL
      // name.
      const name =
        decoded.name.length > 0
          ? decoded.name[0].toUpperCase() + decoded.name.slice(1)
          : decoded.name
      const event: ProgramEvent = { name, data: decoded.data, signature: logs.signature }
      for (const listener of this.listeners) {
        try {
          listener(event)
        } catch (err) {
          // Don't let one buggy listener break the rest.
          console.warn('[ProgramEventStream] listener threw:', err)
        }
      }
    }
  }

  /**
   * Register a listener. Returns the unregister function — call from a
   * `useEffect` cleanup so leaving a page doesn't leak the subscription.
   */
  addListener(listener: EventListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Dispose: removes the WS subscription and clears all listeners. Safe
   * to call multiple times; subsequent calls are no-ops.
   */
  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.listeners.clear()
    if (this.subscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.subscriptionId)
      } catch {
        // Already torn down, best-effort.
      }
      this.subscriptionId = null
    }
  }
}
