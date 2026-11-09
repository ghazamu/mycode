// Roles, routing, budgets and guardrails: pure functions, no engine calls.
// Defaults mirror docs/sdlc/sdlc.config.json; the mod overlays that file when
// it can read it (see loadConfig in register.tsx).

export const ROLES = ['lead', 'dev-core', 'dev-edge', 'dev-utility', 'qa', 'ops'] as const
export type Role = (typeof ROLES)[number]

export function isRole(value: string | undefined): value is Role {
  return value !== undefined && (ROLES as readonly string[]).includes(value)
}

export type BusConfig = {
  repo: string
  maxSummaryChars: number
  heartbeatMinutes: number
  staleAfterMissedHeartbeats: number
  routerPollMinutes: number
  batchSmallMax: number
  autoSpawn: boolean
  githubServer: string
  remoteServer: string
  baselineTokensPerRequest: number
  budgets: Record<string, number>
  warnAt: number
  models: Record<Role, string>
  prompts: Record<Role, string>
  /** Folder globs each role may write; `null` means no restriction. */
  writeScopes: Record<Role, readonly string[] | null>
  /** Folder globs per dev lane, from a spec's "Lane ownership" section. */
  lanePaths: { core: readonly string[]; edge: readonly string[] }
}

export const DEFAULT_CONFIG: BusConfig = {
  repo: 'ghazamu/mycode',
  maxSummaryChars: 600,
  heartbeatMinutes: 10,
  staleAfterMissedHeartbeats: 3,
  routerPollMinutes: 5,
  batchSmallMax: 10,
  autoSpawn: true,
  githubServer: 'github',
  remoteServer: 'claude-code-remote',
  baselineTokensPerRequest: 464000,
  budgets: {
    'size:S': 300000,
    'size:M': 550000,
    'size:L': 1400000,
    'type:design': 500000,
    'type:docs': 300000,
    label: 10000,
  },
  warnAt: 0.8,
  models: {
    lead: 'claude-opus-5-5',
    'dev-core': 'claude-sonnet-5-5',
    'dev-edge': 'claude-sonnet-5-5',
    'dev-utility': 'claude-haiku-5-5',
    qa: 'claude-sonnet-5-5',
    ops: 'claude-haiku-5-5',
  },
  prompts: {
    lead: 'docs/sdlc/roles/lead.md',
    'dev-core': 'docs/sdlc/roles/dev-core.md',
    'dev-edge': 'docs/sdlc/roles/dev-edge.md',
    'dev-utility': 'docs/sdlc/roles/dev-utility.md',
    qa: 'docs/sdlc/roles/qa.md',
    ops: 'docs/sdlc/roles/ops.md',
  },
  writeScopes: {
    lead: ['docs/specs/**', 'docs/adr/**', 'docs/sdlc/**'],
    'dev-core': null,
    'dev-edge': null,
    'dev-utility': null,
    qa: ['tests/**', 'test/**', '**/test_*.py', '**/*_test.py', '**/*.test.*', '**/*.spec.*', '**/conftest.py'],
    ops: ['docs/**', 'README.md', '**/README.md', 'CHANGELOG.md', '.github/**', 'scripts/changelog*', 'VERSION', 'pyproject.toml', 'package.json'],
  },
  lanePaths: { core: [], edge: [] },
}

// ---------------------------------------------------------------- globs

const globCache = new Map<string, RegExp>()

/** `**` any depth, `*` within a segment, `?` one char. Paths use `/`. */
export function globToRegExp(glob: string): RegExp {
  const cached = globCache.get(glob)
  if (cached) return cached
  let out = '^'
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/'
        out += slash ? '(?:.*/)?' : '.*'
        i += slash ? 2 : 1
      } else {
        out += '[^/]*'
      }
    } else if (c === '?') {
      out += '[^/]'
    } else {
      out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  const re = new RegExp(`${out}$`)
  globCache.set(glob, re)
  return re
}

export function matchesAny(path: string, globs: readonly string[]): boolean {
  return globs.some(glob => globToRegExp(glob).test(path))
}

/** Makes a tool's file path relative to the repository root. */
export function relativePath(path: string, root: string): string {
  const clean = path.replace(/\\/g, '/')
  const base = root.replace(/\\/g, '/').replace(/\/$/, '')
  if (clean === base) return ''
  if (clean.startsWith(`${base}/`)) return clean.slice(base.length + 1)
  return clean.replace(/^\.\//, '')
}

// ---------------------------------------------------------------- routing

export type Issue = { number: number; title: string; labels: readonly string[] }

export type Route = {
  role: Role
  kind: string
  budget: number
  /** Why: shown on the board and in the TASK summary. */
  reason: string
}

function labelValue(labels: readonly string[], prefix: string): string | undefined {
  const hit = labels.find(label => label.startsWith(`${prefix}:`))
  return hit?.slice(prefix.length + 1)
}

export function budgetFor(labels: readonly string[], config: BusConfig): number {
  const type = labelValue(labels, 'type')
  const size = labelValue(labels, 'size')
  if (type === 'design') return config.budgets['type:design'] ?? config.baselineTokensPerRequest
  if (type === 'docs') return config.budgets['type:docs'] ?? config.baselineTokensPerRequest
  if (size && config.budgets[`size:${size}`]) return config.budgets[`size:${size}`]!
  return config.budgets['size:M'] ?? config.baselineTokensPerRequest
}

/** Deterministic routing table (DESIGN.md §2A). No model turn. */
export function route(issue: Issue, config: BusConfig): Route {
  const { labels } = issue
  const type = labelValue(labels, 'type')
  const size = labelValue(labels, 'size')
  const lane = labelValue(labels, 'lane')
  const budget = budgetFor(labels, config)
  const opus = labels.includes('review:opus')

  if (!type) {
    return { role: 'lead', kind: 'label', budget: config.budgets.label ?? 10000, reason: 'no type:* label; label only' }
  }
  switch (type) {
    case 'design':
      return { role: 'lead', kind: 'design', budget, reason: 'type:design' }
    case 'docs':
      return { role: 'ops', kind: 'docs', budget, reason: 'type:docs' }
    case 'test':
      return { role: 'qa', kind: 'test', budget, reason: 'type:test' }
    case 'audit':
      return opus
        ? { role: 'lead', kind: 'audit-major', budget, reason: 'type:audit + review:opus' }
        : { role: 'qa', kind: 'audit', budget, reason: 'type:audit' }
    case 'dev': {
      if (size === 'S' || lane === 'utility') {
        return { role: 'dev-utility', kind: 'dev-small', budget, reason: 'type:dev + size:S' }
      }
      if (lane === 'core') return { role: 'dev-core', kind: 'dev', budget, reason: 'type:dev + lane:core' }
      if (lane === 'edge') return { role: 'dev-edge', kind: 'dev', budget, reason: 'type:dev + lane:edge' }
      return {
        role: 'lead',
        kind: 'label',
        budget: config.budgets.label ?? 10000,
        reason: 'type:dev without lane:* or size:S; add a lane label',
      }
    }
    default:
      return { role: 'lead', kind: 'label', budget: config.budgets.label ?? 10000, reason: `unknown type:${type}` }
  }
}

/** Groups routed issues into TASKs; size:S dev work is batched per lane/area. */
export function batch(
  routed: readonly { issue: Issue; route: Route }[],
  batchMax: number,
): { role: Role; kind: string; budget: number; issues: Issue[]; reason: string }[] {
  const out: { role: Role; kind: string; budget: number; issues: Issue[]; reason: string }[] = []
  const small = new Map<string, { issue: Issue; route: Route }[]>()
  for (const item of routed) {
    if (item.route.kind === 'dev-small') {
      const area = labelValue(item.issue.labels, 'area') ?? labelValue(item.issue.labels, 'lane') ?? 'any'
      const list = small.get(area) ?? []
      list.push(item)
      small.set(area, list)
    } else {
      out.push({ ...item.route, issues: [item.issue] })
    }
  }
  for (const [area, items] of small) {
    for (let i = 0; i < items.length; i += batchMax) {
      const chunk = items.slice(i, i + batchMax)
      out.push({
        role: 'dev-utility',
        kind: 'dev-small',
        budget: chunk.reduce((sum, item) => sum + item.route.budget, 0),
        issues: chunk.map(item => item.issue),
        reason: `size:S batch (${chunk.length}) area ${area}`,
      })
    }
  }
  return out
}

// ---------------------------------------------------------------- guards

export type GuardInput = {
  role: Role | undefined
  tool: string
  /** The tool's arguments, as the tool.call event carries them. */
  args: Record<string, unknown>
  root: string
  approvedReleases: readonly string[]
  overBudget: boolean
}

export type GuardResult = { deny: string } | { warn: string } | undefined

const ALWAYS_DENIED_TOOLS: Record<string, string> = {
  mcp__github__merge_pull_request: 'agents never merge; the person merges (gate 2/3)',
  mcp__github__enable_pr_auto_merge: 'agents never enable auto-merge',
}

const LEAD_ONLY_TOOLS = [
  'mcp__claude-code-remote__create_session',
  'mcp__claude-code-remote__archive_session',
  'mcp__devbus__bus_roster_set',
]

const BUS_TOOLS = ['mcp__devbus__bus_send', 'mcp__devbus__bus_board', 'mcp__devbus__bus_set_role']

const FILE_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit']

function bashDeny(command: string, role: Role | undefined, approvedReleases: readonly string[]): string | undefined {
  const cmd = command.replace(/\s+/g, ' ')
  if (/\bgit push\b[^;&|]*(\s--force(?:-with-lease)?\b|\s-f\b|\s\+\S)/.test(cmd)) {
    return 'force-push is blocked for every role'
  }
  if (/\bgit push\b[^;&|]*\s(?:\S+:)?(?:refs\/heads\/)?(?:main|master)\b/.test(cmd)) {
    return 'pushing to main/master is blocked; push a branch and open a PR'
  }
  if (/\bgh pr merge\b/.test(cmd)) return 'agents never merge; the person merges'
  const tag = cmd.match(/\bgit tag\b(?:\s+-[a-z]+(?:\s+"[^"]*"|\s+'[^']*')?)*\s+(v?\d[\w.\-]*)/)
  const release = cmd.match(/\bgh release create\s+(v?\d[\w.\-]*)/)
  const version = tag?.[1] ?? release?.[1]
  if (version) {
    if (role !== 'ops') return 'only Ops tags and publishes releases'
    if (!approvedReleases.includes(version)) {
      return `release ${version} has no approval; the person runs /devbus-approve-release ${version} after merging the release PR`
    }
  }
  return undefined
}

export function guard(input: GuardInput): GuardResult {
  const { role, tool, args } = input

  if (ALWAYS_DENIED_TOOLS[tool]) return { deny: ALWAYS_DENIED_TOOLS[tool]! }

  if (input.overBudget && !BUS_TOOLS.includes(tool)) {
    return {
      deny:
        'this request is over its token budget. Stop: send BUDGET or ESCALATE with bus_send ' +
        '(what is done, what is left, where) and end the turn.',
    }
  }

  if (LEAD_ONLY_TOOLS.includes(tool) && role !== 'lead') return { deny: `${tool} is the Lead's alone` }

  if (tool === 'mcp__github__create_release' || tool === 'mcp__github__create_tag') {
    const version = String(args.tag_name ?? args.tag ?? '')
    if (role !== 'ops') return { deny: 'only Ops tags and publishes releases' }
    if (!input.approvedReleases.includes(version)) {
      return { deny: `release ${version || '(unnamed)'} has no approval (/devbus-approve-release)` }
    }
  }

  if (tool === 'Bash' && typeof args.command === 'string') {
    const deny = bashDeny(args.command, role, input.approvedReleases)
    if (deny) return { deny }
  }

  if (FILE_TOOLS.includes(tool) && role) {
    const raw = String(args.file_path ?? args.notebook_path ?? '')
    if (raw) {
      return fileScope(role, relativePath(raw, input.root))
    }
  }
  return undefined
}

// The write scopes in effect; replaced by setScopes when the config loads.
let activeScopes: BusConfig['writeScopes'] = DEFAULT_CONFIG.writeScopes
let activeLanes: BusConfig['lanePaths'] = DEFAULT_CONFIG.lanePaths

export function setScopes(config: BusConfig): void {
  activeScopes = config.writeScopes
  activeLanes = config.lanePaths
}

function fileScope(role: Role, path: string): GuardResult {
  if (path.startsWith('/') || path.startsWith('..')) return undefined // outside the repo: not ours
  const scope = activeScopes[role]
  if (scope && !matchesAny(path, scope)) {
    return { deny: `${role} may not edit ${path}; its scope is ${scope.join(', ')}` }
  }
  if (role === 'dev-core' && activeLanes.core.length > 0 && !matchesAny(path, activeLanes.core)) {
    return { warn: `${path} is outside the core lane` }
  }
  if (role === 'dev-edge' && activeLanes.edge.length > 0 && !matchesAny(path, activeLanes.edge)) {
    return { warn: `${path} is outside the edge lane` }
  }
  return undefined
}

// ---------------------------------------------------------------- usage

export type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

/** Every token a response was billed over: uncached + cache write + cache read + output. */
export function totalTokens(usage: Usage): number {
  return (
    usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens + usage.output_tokens
  )
}

export type BudgetLevel = 'ok' | 'warn' | 'over'

export function budgetLevel(tokens: number, budget: number, warnAt: number): BudgetLevel {
  if (budget <= 0) return 'ok'
  if (tokens >= budget) return 'over'
  if (tokens >= budget * warnAt) return 'warn'
  return 'ok'
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

export type UsageRecord = { task: string; kind: string; role: string; model: string; tokens: number; at: number }

/** Average tokens per request by kind, against the measured baseline. */
export function usageReport(records: readonly UsageRecord[], baseline: number): string {
  if (records.length === 0) return 'No completed requests recorded yet.'
  const byKind = new Map<string, { n: number; tokens: number }>()
  for (const r of records) {
    const row = byKind.get(r.kind) ?? { n: 0, tokens: 0 }
    row.n += 1
    row.tokens += r.tokens
    byKind.set(r.kind, row)
  }
  const lines = ['kind            requests   avg tokens   vs baseline']
  let n = 0
  let total = 0
  for (const [kind, row] of [...byKind].sort()) {
    const avg = row.tokens / row.n
    n += row.n
    total += row.tokens
    lines.push(
      `${kind.padEnd(16)}${String(row.n).padStart(8)}   ${formatTokens(Math.round(avg)).padStart(10)}   ${(avg / baseline).toFixed(2)}x`,
    )
  }
  lines.push(
    `${'all'.padEnd(16)}${String(n).padStart(8)}   ${formatTokens(Math.round(total / n)).padStart(10)}   ${(total / n / baseline).toFixed(2)}x`,
  )
  return lines.join('\n')
}
