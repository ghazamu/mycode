// DevBus state contract: every value the mod keeps in $.state.

export type RosterEntry = {
  role: string
  sessionId: string
  /** ms since epoch of the last message or heartbeat from that session. */
  lastSeen: number
  /** The task it last reported, '-' when none. */
  task: string
}

export type CurrentTask = {
  /** '#12' or '#12,#13' for a batch; '' when idle. */
  task: string
  kind: string
  budget: number
  tokens: number
  model: string
  startedAt: number
  /** Whether the 80% warning has been shown. */
  warned: boolean
  /** Whether BUDGET was sent to the Lead. */
  reported: boolean
}

export type FeedItem = {
  at: number
  /** 'in' received, 'out' sent, 'note' the mod's own line. */
  dir: 'in' | 'out' | 'note'
  type: string
  peer: string
  task: string
  text: string
}

export type UsageEntry = {
  task: string
  kind: string
  role: string
  model: string
  tokens: number
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    devbus: {
      role: Shaped<string>
      roster: Shaped<RosterEntry[]>
      current: Shaped<CurrentTask>
      feed: Shaped<FeedItem[]>
      seen: Shaped<string[]>
      approvals: Shaped<string[]>
      usage: Shaped<UsageEntry[]>
      routed: Shaped<number[]>
    }
  }
}
