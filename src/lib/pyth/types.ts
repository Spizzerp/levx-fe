/** Parsed tick shape stored in pythStore. */
export interface PythTick {
  /** unix ms — derived from Pyth publishTime (seconds) * 1000 */
  time: number
  /** price in quote units (number, already converted from Pyth fixed-point) */
  value: number
  /** unix seconds — canonical Pyth timestamp used for dedup */
  publishTime: number
}

export type PythStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'
