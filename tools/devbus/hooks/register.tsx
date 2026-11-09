import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CurrentTask, FeedItem, RosterEntry, UsageEntry } from '../types'
import {
  CONSUMED_TYPES,
  MESSAGE_TYPES,
  format,
  isMessageType,
  newId,
  normalize,
  parse,
  ref,
  scrubSecrets,
  validate,
} from './lib/envelope'
import type { Envelope, MessageType } from './lib/envelope'
import {
  DEFAULT_CONFIG,
  ROLES,
  batch,
  budgetLevel,
  formatTokens,
  guard,
  isRole,
  route,
  setScopes,
  totalTokens,
  usageReport,
} from './lib/policy'
import type { BusConfig, Issue, Role } from './lib/policy'

// ---------------------------------------------------------------- state

const PANE = 'devbus-board'
const CONFIG_PATH = 'docs/sdlc/sdlc.config.json'
const USAGE_LOG = '.devbus/usage.jsonl'
const IDLE: CurrentTask = {
  task: '',
  kind: '',
  budget: 0,
  tokens: 0,
  model: '',
  startedAt: 0,
  warned: false,
  reported: false,
}

const roleAtom = atom({ plugin: 'devbus', key: 'role' } as const, '', { shape: 'role-1' })
const rosterAtom = atom({ plugin: 'devbus', key: 'roster' } as const, [] as RosterEntry[], { shape: 'roster-1' })
const currentAtom = atom({ plugin: 'devbus', key: 'current' } as const, IDLE, { shape: 'current-1' })
const feedAtom = atom({ plugin: 'devbus', key: 'feed' } as const, [] as FeedItem[], { shape: 'feed-1' })
const seenAtom = atom({ plugin: 'devbus', key: 'seen' } as const, [] as string[], { shape: 'seen-1' })
const approvalsAtom = atom({ plugin: 'devbus', key: 'approvals' } as const, [] as string[], { shape: 'approvals-1' })
const usageAtom = atom({ plugin: 'devbus', key: 'usage' } as const, [] as UsageEntry[], { shape: 'usage-1' })
const routedAtom = atom({ plugin: 'devbus', key: 'routed' } as const, [] as number[], { shape: 'routed-1' })

// Module variables start over on every reload; session.start sets them again.
let config: BusConfig = DEFAULT_CONFIG
let root = ''

// ---------------------------------------------------------------- helpers

async function myRole($: EngineInterface): Promise<Role | undefined> {
  const role = await read($, roleAtom)
  return isRole(role) ? role : undefined
}

async function note($: EngineInterface, item: Omit<FeedItem, 'at'>): Promise<void> {
  const at = await $.clock.now()
  await update($, feedAtom, feed => [...feed, { ...item, at }].slice(-60))
}

function overlayConfig(raw: unknown): BusConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG
  const c = raw as Record<string, any>
  const next: BusConfig = {
    ...DEFAULT_CONFIG,
    budgets: { ...DEFAULT_CONFIG.budgets },
    models: { ...DEFAULT_CONFIG.models },
    prompts: { ...DEFAULT_CONFIG.prompts },
    writeScopes: { ...DEFAULT_CONFIG.writeScopes },
    lanePaths: { ...DEFAULT_CONFIG.lanePaths },
  }
  if (typeof c.repo === 'string') next.repo = c.repo
  if (typeof c.maxSummaryChars === 'number') next.maxSummaryChars = c.maxSummaryChars
  if (typeof c.heartbeatMinutes === 'number') next.heartbeatMinutes = c.heartbeatMinutes
  if (typeof c.staleAfterMissedHeartbeats === 'number') next.staleAfterMissedHeartbeats = c.staleAfterMissedHeartbeats
  const per = c.budgets?.perRequestTokens
  if (per && typeof per === 'object') {
    for (const [key, value] of Object.entries(per)) if (typeof value === 'number') next.budgets[key] = value
  }
  if (typeof c.budgets?.warnAt === 'number') next.warnAt = c.budgets.warnAt
  if (typeof c.lean?.batchSmallMax === 'number') next.batchSmallMax = c.lean.batchSmallMax
  const baseline = c.costModel?.baseline?.tokensPerRequest
  if (typeof baseline === 'number') next.baselineTokensPerRequest = baseline
  for (const role of ROLES) {
    const entry = c.roles?.[role]
    if (!entry) continue
    if (typeof entry.model === 'string') next.models[role] = entry.model
    if (typeof entry.prompt === 'string') next.prompts[role] = entry.prompt
  }
  const bus = c.devbus
  if (bus && typeof bus === 'object') {
    if (typeof bus.routerPollMinutes === 'number') next.routerPollMinutes = bus.routerPollMinutes
    if (typeof bus.autoSpawn === 'boolean') next.autoSpawn = bus.autoSpawn
    if (typeof bus.githubServer === 'string') next.githubServer = bus.githubServer
    if (typeof bus.remoteServer === 'string') next.remoteServer = bus.remoteServer
    const lanes = bus.lanePaths
    if (Array.isArray(lanes?.core)) next.lanePaths.core = lanes.core.filter((g: unknown) => typeof g === 'string')
    if (Array.isArray(lanes?.edge)) next.lanePaths.edge = lanes.edge.filter((g: unknown) => typeof g === 'string')
    const scopes = bus.writeScopes
    if (scopes && typeof scopes === 'object') {
      for (const role of ROLES) {
        const s = scopes[role]
        if (s === null) next.writeScopes[role] = null
        else if (Array.isArray(s)) next.writeScopes[role] = s.filter((g: unknown) => typeof g === 'string')
      }
    }
  }
  return next
}

async function loadConfig($: EngineInterface): Promise<void> {
  try {
    if (await $.fs.exists(CONFIG_PATH)) {
      config = overlayConfig(JSON.parse(await $.fs.read(CONFIG_PATH)))
    }
  } catch {
    config = DEFAULT_CONFIG
  }
  setScopes(config)
}

function mcpText(result: unknown): string {
  const content = (result as { content?: { type?: string; text?: string }[] })?.content ?? []
  return content
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
}

function mcpFailed(result: unknown): boolean {
  return (result as { isError?: boolean })?.isError === true
}

// ---------------------------------------------------------------- sending

type SendArgs = {
  to: string
  type: MessageType
  task?: string
  pr?: string
  sha?: string
  reply?: string
  summary: string
  extra?: Record<string, string>
}

/** Delivers a raw text to the session that holds `role`. */
async function deliver($: EngineInterface, role: string, text: string): Promise<{ ok: boolean; reason?: string }> {
  const roster = await read($, rosterAtom)
  const entry = roster.find(r => r.role === role)
  if (!entry) return { ok: false, reason: `no session holds ${role} in the roster` }

  const sent = await $.session.send({ to: { sessionId: entry.sessionId }, text })
  if (sent.isDelivered) return { ok: true }

  // The native bus refused (e.g. a cloud session it cannot address): fall back
  // to the remote-session server's send_message, when the session has it.
  try {
    const viaRemote = await $.mcp.call(config.remoteServer, 'send_message', {
      session_id: entry.sessionId,
      message: text,
    })
    if (!mcpFailed(viaRemote)) return { ok: true }
    return { ok: false, reason: mcpText(viaRemote) || sent.reason }
  } catch {
    return { ok: false, reason: sent.reason }
  }
}

/** Builds, validates and sends one envelope (or one per role for `*`). */
async function sendEnvelope($: EngineInterface, args: SendArgs): Promise<{ ok: boolean; text: string }> {
  const from = (await myRole($)) ?? 'unassigned'
  const current = await read($, currentAtom)
  const extra: Record<string, string> = { ...(args.extra ?? {}) }
  // Usage rides along on the messages that close or pause a request.
  if (current.task && ['DONE', 'STATUS', 'BUDGET', 'ESCALATE'].includes(args.type)) {
    extra.tokens = String(current.tokens)
    extra.kind = extra.kind ?? current.kind
  }
  const scrubbed = scrubSecrets(args.summary)
  const base: Envelope = {
    id: newId(await $.clock.now()),
    type: args.type,
    from,
    to: args.to,
    task: ref(args.task ?? (current.task || '-')),
    pr: ref(args.pr),
    sha: args.sha?.trim() || '-',
    reply: args.reply?.trim() || '-',
    extra,
    summary: scrubbed.text,
  }
  const problem = validate(base, config.maxSummaryChars)
  if (problem) return { ok: false, text: `Not sent: ${problem}` }

  const targets =
    args.to === '*' ? (await read($, rosterAtom)).map(r => r.role).filter(role => role !== from) : [args.to]
  if (targets.length === 0) return { ok: false, text: 'Not sent: nobody else is in the roster yet.' }

  const failures: string[] = []
  for (const target of targets) {
    const envelope = { ...base, to: target, id: targets.length > 1 ? newId(await $.clock.now()) : base.id }
    const result = await deliver($, target, format(envelope))
    if (!result.ok) failures.push(`${target}: ${result.reason ?? 'not delivered'}`)
  }
  await note($, { dir: 'out', type: args.type, peer: args.to, task: base.task, text: base.summary.slice(0, 120) })

  if (args.type === 'DONE' && current.task) await finishTask($, current)

  const redacted = scrubbed.redactions > 0 ? ` (${scrubbed.redactions} secret-like value(s) redacted)` : ''
  if (failures.length === targets.length) return { ok: false, text: `Not delivered: ${failures.join('; ')}` }
  if (failures.length > 0) return { ok: true, text: `Sent (id ${base.id}); failed for ${failures.join('; ')}${redacted}` }
  return { ok: true, text: `Sent ${args.type} to ${args.to} (id ${base.id})${redacted}` }
}

// ---------------------------------------------------------------- tasks and usage

async function startTask($: EngineInterface, envelope: Envelope): Promise<void> {
  const budget = Number(envelope.extra.budget) || 0
  const startedAt = await $.clock.now()
  await update($, currentAtom, () => ({
    ...IDLE,
    task: envelope.task,
    kind: envelope.extra.kind ?? 'task',
    budget,
    startedAt,
  }))
}

async function finishTask($: EngineInterface, current: CurrentTask): Promise<void> {
  const role = (await myRole($)) ?? 'unassigned'
  const entry: UsageEntry = {
    task: current.task,
    kind: current.kind,
    role,
    model: current.model,
    tokens: current.tokens,
    at: await $.clock.now(),
  }
  await update($, usageAtom, list => [...list, entry].slice(-1000))
  await update($, currentAtom, () => IDLE)
  try {
    const before = (await $.fs.exists(USAGE_LOG)) ? await $.fs.read(USAGE_LOG) : ''
    await $.fs.write(USAGE_LOG, `${before}${JSON.stringify(entry)}\n`)
  } catch {
    // The log is a convenience; the state copy is the record.
  }
  $.ui.status(undefined)
}

async function showStatus($: EngineInterface): Promise<void> {
  const role = await myRole($)
  const current = await read($, currentAtom)
  if (!role) return $.ui.status('devbus · no role')
  if (!current.task) return $.ui.status(`devbus · ${role} · idle`)
  const budget = current.budget > 0 ? `/${formatTokens(current.budget)}` : ''
  $.ui.status(`devbus · ${role} · ${current.task} · ${formatTokens(current.tokens)}${budget}`)
}

// ---------------------------------------------------------------- receiving

async function touch($: EngineInterface, role: string, task: string): Promise<void> {
  const now = await $.clock.now()
  await update($, rosterAtom, roster =>
    roster.map(r => (r.role === role ? { ...r, lastSeen: now, task: task !== '-' ? task : r.task } : r)),
  )
}

async function adoptRoster($: EngineInterface, envelope: Envelope): Promise<void> {
  try {
    const list = JSON.parse(envelope.summary) as { role: string; sessionId: string }[]
    const valid = list.filter(r => isRole(r.role) && typeof r.sessionId === 'string')
    await update($, rosterAtom, () => valid.map(r => ({ role: r.role, sessionId: r.sessionId, lastSeen: 0, task: '-' })))
    if (!(await myRole($)) && isRole(envelope.to)) {
      await update($, roleAtom, () => envelope.to)
      await note($, { dir: 'note', type: 'ROLE', peer: 'lead', task: '-', text: `role set to ${envelope.to} by ROSTER` })
    }
  } catch {
    await note($, { dir: 'note', type: 'ERROR', peer: envelope.from, task: '-', text: 'unreadable ROSTER body' })
  }
}

// ---------------------------------------------------------------- roster (Lead)

async function broadcastRoster($: EngineInterface): Promise<string[]> {
  const roster = await read($, rosterAtom)
  const body = JSON.stringify(roster.map(r => ({ role: r.role, sessionId: r.sessionId })))
  const failures: string[] = []
  for (const entry of roster) {
    if (entry.role === 'lead') continue
    const envelope: Envelope = {
      id: newId(await $.clock.now()),
      type: 'ROSTER',
      from: 'lead',
      to: entry.role,
      task: '-',
      pr: '-',
      sha: '-',
      reply: '-',
      extra: {},
      summary: body,
    }
    const result = await deliver($, entry.role, format(envelope))
    if (!result.ok) failures.push(`${entry.role}: ${result.reason}`)
  }
  return failures
}

async function setRosterEntry($: EngineInterface, role: Role, sessionId: string): Promise<void> {
  await update($, rosterAtom, roster => [
    ...roster.filter(r => r.role !== role),
    { role, sessionId, lastSeen: 0, task: '-' },
  ])
}

async function spawn($: EngineInterface, role: Role): Promise<{ ok: boolean; reason?: string }> {
  let prompt = ''
  try {
    prompt = await $.fs.read(config.prompts[role])
  } catch {
    return { ok: false, reason: `cannot read ${config.prompts[role]}` }
  }
  const instructions =
    `${prompt}\n\nYour DevBus role is ${role}. If mcp__devbus__bus_set_role is available and you have no role yet, ` +
    `call it with role "${role}" before anything else. Read docs/sdlc/protocol.md and the lane repo map in ` +
    'docs/sdlc/repo-map/ before exploring the codebase.'
  try {
    const result = await $.mcp.call(config.remoteServer, 'create_session', {
      title: `DevBus ${role}`,
      model: config.models[role],
      append_system_prompt: instructions,
      source_url: `https://github.com/${config.repo}`,
      prompt: `You are the ${role} session of the DevBus team. Wait for a TASK message from the Lead.`,
    })
    if (mcpFailed(result)) return { ok: false, reason: mcpText(result) || 'create_session failed' }
    const id = mcpText(result).match(/session_[A-Za-z0-9]+/)?.[0]
    if (!id) return { ok: false, reason: 'create_session returned no session id' }
    await setRosterEntry($, role, id)
    await broadcastRoster($)
    await note($, { dir: 'note', type: 'SPAWN', peer: role, task: '-', text: `${role} → ${id} (${config.models[role]})` })
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: String(error) }
  }
}

// ---------------------------------------------------------------- router (Lead)

function parseIssues(text: string): Issue[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  const list: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { issues?: unknown[] })?.issues)
      ? (data as { issues: unknown[] }).issues
      : []
  const issues: Issue[] = []
  for (const item of list) {
    const i = item as { number?: number; title?: string; labels?: (string | { name?: string })[]; pull_request?: unknown }
    if (typeof i.number !== 'number' || i.pull_request) continue
    const labels = (i.labels ?? [])
      .map(l => (typeof l === 'string' ? l : (l?.name ?? '')))
      .filter(l => l !== '')
    issues.push({ number: i.number, title: i.title ?? '', labels })
  }
  return issues
}

let routing = false

async function routeOnce($: EngineInterface): Promise<string> {
  if (routing) return 'Router is already running.'
  routing = true
  try {
    if ((await myRole($)) !== 'lead') return 'Only the Lead routes.'
    const [owner, repo] = config.repo.split('/')
    const listed = await $.mcp.call(config.githubServer, 'list_issues', {
      owner,
      repo,
      state: 'OPEN',
      labels: ['state:planned'],
      perPage: 50,
    })
    if (mcpFailed(listed)) return `list_issues failed: ${mcpText(listed).slice(0, 200)}`
    const done = new Set(await read($, routedAtom))
    const fresh = parseIssues(mcpText(listed)).filter(i => !done.has(i.number))
    if (fresh.length === 0) return 'No new planned issues.'

    const tasks = batch(
      fresh.map(issue => ({ issue, route: route(issue, config) })),
      config.batchSmallMax,
    )
    const lines: string[] = []
    for (const task of tasks) {
      const roster = await read($, rosterAtom)
      if (task.role !== 'lead' && !roster.some(r => r.role === task.role)) {
        if (!config.autoSpawn) {
          lines.push(`${task.role}: not running (autoSpawn off); left planned`)
          continue
        }
        const spawned = await spawn($, task.role)
        if (!spawned.ok) {
          lines.push(`${task.role}: spawn failed (${spawned.reason}); left planned`)
          continue
        }
      }
      const numbers = task.issues.map(i => i.number)
      const taskRef = ref(numbers.join(','))
      const titles = task.issues.map(i => `#${i.number} ${i.title}`).join('; ')
      const summary = `${task.reason}. ${titles}`.slice(0, config.maxSummaryChars)
      const extra: Record<string, string> = { kind: task.kind, budget: String(task.budget) }
      if (task.issues.length > 1) extra.batch = taskRef

      if (task.role === 'lead') {
        // The Lead is this session: the model gets the task directly.
        lines.push(`lead: ${taskRef} (${task.kind}): ${task.reason}`)
        void $.prompt.submit({
          text: normalize({
            id: newId(await $.clock.now()),
            type: 'TASK',
            from: 'router',
            to: 'lead',
            task: taskRef,
            pr: '-',
            sha: '-',
            reply: '-',
            extra,
            summary,
          }),
        })
      } else {
        const sent = await sendEnvelope($, { to: task.role, type: 'TASK', task: taskRef, summary, extra })
        if (!sent.ok) {
          lines.push(`${task.role}: ${sent.text}; left planned`)
          continue
        }
        lines.push(`${task.role}: ${taskRef} (${task.kind}, budget ${formatTokens(task.budget)})`)
      }
      for (const issue of task.issues) {
        const labels = [
          ...issue.labels.filter(l => l !== 'state:planned' && !l.startsWith('routed:')),
          'state:in-progress',
          `routed:${task.role}`,
        ]
        try {
          await $.mcp.call(config.githubServer, 'issue_write', {
            method: 'update',
            owner,
            repo,
            issue_number: issue.number,
            labels,
          })
        } catch {
          lines.push(`#${issue.number}: routed, but relabelling failed`)
        }
      }
      await update($, routedAtom, list => [...list, ...numbers].slice(-5000))
    }
    for (const line of lines) await note($, { dir: 'note', type: 'ROUTE', peer: 'router', task: '-', text: line })
    return lines.join('\n') || 'Nothing routed.'
  } catch (error) {
    await note($, { dir: 'note', type: 'ERROR', peer: 'router', task: '-', text: String(error).slice(0, 160) })
    return `Router error: ${String(error)}`
  } finally {
    routing = false
  }
}

// ---------------------------------------------------------------- board text

async function boardText($: EngineInterface): Promise<string> {
  const role = (await myRole($)) ?? 'unassigned'
  const roster = await read($, rosterAtom)
  const current = await read($, currentAtom)
  const feed = await read($, feedAtom)
  const now = await $.clock.now()
  const staleMs = config.heartbeatMinutes * config.staleAfterMissedHeartbeats * 60_000
  const lines = [`role: ${role}`]
  lines.push(
    current.task
      ? `current: ${current.task} (${current.kind}) ${formatTokens(current.tokens)}/${formatTokens(current.budget)} tokens`
      : 'current: idle',
  )
  lines.push('roster:')
  for (const r of roster) {
    const age = r.lastSeen ? `${Math.round((now - r.lastSeen) / 60_000)}m ago` : 'never'
    const stale = r.role !== role && r.lastSeen && now - r.lastSeen > staleMs ? ' STALE' : ''
    lines.push(`  ${r.role.padEnd(11)} ${r.sessionId}  task ${r.task}  seen ${age}${stale}`)
  }
  if (roster.length === 0) lines.push('  (empty)')
  const pending = feed.filter(f => f.type === 'APPROVAL_REQ' || f.type === 'BLOCKED' || f.type === 'ESCALATE').slice(-5)
  if (pending.length) {
    lines.push('needs attention:')
    for (const f of pending) lines.push(`  ${f.type} from ${f.peer} ${f.task}: ${f.text}`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------- register

const TOOL = {
  send: 'mcp__devbus__bus_send',
  board: 'mcp__devbus__bus_board',
  setRole: 'mcp__devbus__bus_set_role',
  rosterSet: 'mcp__devbus__bus_roster_set',
  route: 'mcp__devbus__bus_route',
} as const

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    root = await $.session.root().catch(() => '')
    await loadConfig($)
    const fromEnv = await $.env.get('DEVBUS_ROLE')
    if (isRole(fromEnv) && !(await myRole($))) await update($, roleAtom, () => fromEnv)

    await $.tool.register({
      name: 'bus_send',
      description:
        'Send a DevBus message to another team session by role. Pointers only: cite #issue, #pr, sha, ' +
        `path:line; never paste code, diffs or logs (summary ≤ ${config.maxSummaryChars} chars). ` +
        'Use to="*" to message everyone. Replies set reply=<id> of the message answered.',
      isDeferred: false,
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', enum: [...ROLES, '*'] },
          type: { type: 'string', enum: MESSAGE_TYPES.filter(t => !['ROSTER', 'ACK', 'HEARTBEAT'].includes(t)) },
          task: { type: 'string', description: 'Issue number(s), e.g. "12" or "12,13". Defaults to the current task.' },
          pr: { type: 'string', description: 'PR number, if any' },
          sha: { type: 'string', description: 'Short commit sha, if any' },
          reply: { type: 'string', description: 'id of the message this answers' },
          summary: { type: 'string', description: 'What happened / what you need. Options A/B for BLOCKED.' },
        },
        required: ['to', 'type', 'summary'],
        additionalProperties: false,
      },
    })
    await $.tool.register({
      name: 'bus_board',
      description: 'Show the DevBus board: your role, current task and token budget, the roster, and items needing attention.',
      isDeferred: false,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    })
    await $.tool.register({
      name: 'bus_set_role',
      description: 'Set this session\'s DevBus role once, when it has none (your role prompt names it).',
      inputSchema: {
        type: 'object',
        properties: { role: { type: 'string', enum: [...ROLES] } },
        required: ['role'],
        additionalProperties: false,
      },
    })
    await $.tool.register({
      name: 'bus_roster_set',
      description:
        'Lead only: record which session holds a role (after create_session) and broadcast the roster to every session.',
      inputSchema: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: [...ROLES] },
          session_id: { type: 'string', description: 'The session id create_session returned (session_...)' },
        },
        required: ['role', 'session_id'],
        additionalProperties: false,
      },
    })
    await $.tool.register({
      name: 'bus_route',
      description: 'Lead only: route planned GitHub issues to their sessions now, instead of waiting for the next poll.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    })

    for (const command of [
      { name: 'devbus', description: 'Open the DevBus team board' },
      { name: 'devbus-role', description: 'Set this session\'s DevBus role: /devbus-role <role>' },
      { name: 'devbus-roster', description: 'Lead: record a session for a role: /devbus-roster <role> <session_id>' },
      { name: 'devbus-approve-release', description: 'Approve a release tag after merging its PR: /devbus-approve-release vX.Y.Z' },
      { name: 'devbus-usage', description: 'Tokens per request by kind, against the measured baseline' },
      { name: 'devbus-route', description: 'Lead: route planned issues now' },
    ]) {
      await $.command.register(command)
    }

    // Heartbeat to the Lead; the Lead's mod consumes it, so it costs no model turn.
    $.clock.every(Math.max(1, config.heartbeatMinutes) * 60_000, async () => {
      const role = await myRole($)
      const roster = await read($, rosterAtom)
      if (!role || role === 'lead' || !roster.some(r => r.role === 'lead')) return
      const current = await read($, currentAtom)
      const envelope: Envelope = {
        id: newId(await $.clock.now()),
        type: 'HEARTBEAT',
        from: role,
        to: 'lead',
        task: current.task || '-',
        pr: '-',
        sha: '-',
        reply: '-',
        extra: current.task ? { tokens: String(current.tokens) } : {},
        summary: '',
      }
      await deliver($, 'lead', format(envelope))
    })

    // The router: the Lead's mod turns planned issues into TASKs without a model turn.
    $.clock.every(Math.max(1, config.routerPollMinutes) * 60_000, async () => {
      if ((await myRole($)) === 'lead') await routeOnce($)
    })

    void $.ui.open({ id: PANE, title: 'DevBus' })
    await showStatus($)
    return next(e)
  })

  // ---- model tools
  on('tool.call', { tool: TOOL.send }, async ($, e) => {
    const args = e as unknown as Record<string, unknown>
    const type = String(args.type ?? '')
    if (!isMessageType(type)) return { result: `Unknown type ${type}.` }
    const sent = await sendEnvelope($, {
      to: String(args.to ?? ''),
      type,
      task: args.task === undefined ? undefined : String(args.task),
      pr: args.pr === undefined ? undefined : String(args.pr),
      sha: args.sha === undefined ? undefined : String(args.sha),
      reply: args.reply === undefined ? undefined : String(args.reply),
      summary: String(args.summary ?? ''),
    })
    await showStatus($)
    return { result: sent.text }
  })

  on('tool.call', { tool: TOOL.board }, async $ => ({ result: await boardText($) }))

  on('tool.call', { tool: TOOL.setRole }, async ($, e) => {
    const role = String((e as unknown as Record<string, unknown>).role ?? '')
    if (!isRole(role)) return { result: `Unknown role ${role}.` }
    const existing = await myRole($)
    if (existing && existing !== role) {
      return { result: `This session is already ${existing}; only the person can change it (/devbus-role).` }
    }
    await update($, roleAtom, () => role)
    await showStatus($)
    return { result: `Role set to ${role}.` }
  })

  on('tool.call', { tool: TOOL.rosterSet }, async ($, e) => {
    const args = e as unknown as Record<string, unknown>
    const role = String(args.role ?? '')
    const sessionId = String(args.session_id ?? '')
    if (!isRole(role) || !sessionId) return { result: 'Need a known role and a session_id.' }
    await setRosterEntry($, role, sessionId)
    const failures = await broadcastRoster($)
    return { result: failures.length ? `Roster saved; broadcast failed for ${failures.join('; ')}` : 'Roster saved and broadcast.' }
  })

  on('tool.call', { tool: TOOL.route }, async $ => ({ result: await routeOnce($) }))

  // ---- guardrails on every other tool call
  on('tool.call', async ($, e, next) => {
    if (e.tool.startsWith('mcp__devbus__') && e.tool !== TOOL.rosterSet) return next(e)
    const current = await read($, currentAtom)
    const verdict = guard({
      role: await myRole($),
      tool: e.tool,
      args: e as unknown as Record<string, unknown>,
      root,
      approvedReleases: await read($, approvalsAtom),
      overBudget: current.task !== '' && budgetLevel(current.tokens, current.budget, config.warnAt) === 'over',
    })
    if (verdict && 'deny' in verdict) return { deny: `DevBus: ${verdict.deny}` }
    if (verdict && 'warn' in verdict) $.ui.toast(`DevBus: ${verdict.warn}`)
    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: 'DevBus: its guard failed; refusing to be safe.' }))

  // ---- outgoing: the model's own SendMessage must carry an envelope
  on('session.send', async ($, e, next) => {
    if (e.origin.kind === 'model' && !parse(e.text)) {
      return {
        isDelivered: false as const,
        reason: 'DevBus: use the bus_send tool so the message carries an envelope (pointers only).',
      }
    }
    const scrubbed = scrubSecrets(e.text)
    return next(scrubbed.redactions > 0 ? { ...e, text: scrubbed.text } : e)
  })

  // ---- incoming: consume routine traffic, shorten the rest
  on('session.receive', async ($, e, next) => {
    const envelope = parse(e.text)
    if (!envelope) return next(e)

    const seen = await read($, seenAtom)
    if (seen.includes(envelope.id)) return { consumed: `devbus: duplicate ${envelope.id}` }
    await update($, seenAtom, ids => [...ids, envelope.id].slice(-500))

    await touch($, envelope.from, envelope.task)
    if (envelope.type !== 'HEARTBEAT') {
      await note($, {
        dir: 'in',
        type: envelope.type,
        peer: envelope.from,
        task: envelope.task,
        text: envelope.type === 'ROSTER' ? 'roster update' : envelope.summary.slice(0, 120),
      })
    }

    if (envelope.type === 'ROSTER') await adoptRoster($, envelope)

    if (envelope.type === 'DONE' && envelope.extra.tokens) {
      // The Lead keeps every session's usage, for /devbus-usage and the pilot.
      const entry: UsageEntry = {
        task: envelope.task,
        kind: envelope.extra.kind ?? 'task',
        role: envelope.from,
        model: '',
        tokens: Number(envelope.extra.tokens) || 0,
        at: await $.clock.now(),
      }
      await update($, usageAtom, list => [...list, entry].slice(-1000))
    }

    if (envelope.type === 'TASK') {
      await startTask($, envelope)
      await showStatus($)
      // ACK by the mod: the sender's mod consumes it, so neither model spends a turn.
      const me = (await myRole($)) ?? envelope.to
      await deliver(
        $,
        envelope.from,
        format({
          id: newId(await $.clock.now()),
          type: 'ACK',
          from: me,
          to: envelope.from,
          task: envelope.task,
          pr: '-',
          sha: '-',
          reply: envelope.id,
          extra: {},
          summary: '',
        }),
      )
    }

    if (envelope.type === 'APPROVAL_REQ' || envelope.type === 'BLOCKED' || envelope.type === 'BUDGET') {
      $.ui.toast(`DevBus: ${envelope.type} from ${envelope.from} ${envelope.task}`)
    }

    if (CONSUMED_TYPES.includes(envelope.type)) return { consumed: `devbus: ${envelope.type}` }
    return next({ ...e, text: normalize(envelope) })
  })

  // ---- usage and budgets, per model response
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    if (!result.usage) return result
    const current = await read($, currentAtom)
    if (!current.task) return result
    const tokens = current.tokens + totalTokens(result.usage)
    const level = budgetLevel(tokens, current.budget, config.warnAt)
    await update($, currentAtom, c => ({
      ...c,
      tokens,
      model: result.usage?.model ?? c.model,
      warned: c.warned || level !== 'ok',
    }))
    if (level === 'warn' && !current.warned) {
      $.ui.toast(`DevBus: ${current.task} at ${formatTokens(tokens)} of ${formatTokens(current.budget)} tokens`)
    }
    if (level === 'over' && !current.reported) {
      await update($, currentAtom, c => ({ ...c, reported: true }))
      if ((await myRole($)) !== 'lead') {
        await sendEnvelope($, {
          to: 'lead',
          type: 'BUDGET',
          summary: `Over budget: ${formatTokens(tokens)} of ${formatTokens(current.budget)} tokens. Further tool calls are blocked.`,
        })
      }
    }
    await showStatus($)
    return result
  })

  // ---- commands
  on('command.run', { command: 'devbus' }, async $ => {
    await $.ui.open({ id: PANE, title: 'DevBus' })
    return { text: await boardText($), isTextDisplayOnly: true }
  })

  on('command.run', { command: 'devbus-role' }, async ($, e) => {
    const role = e.args.trim()
    if (!isRole(role)) return { text: `Usage: /devbus-role <${ROLES.join('|')}>`, isTextDisplayOnly: true }
    await update($, roleAtom, () => role)
    await showStatus($)
    return { text: `DevBus role: ${role}`, isTextDisplayOnly: true }
  })

  on('command.run', { command: 'devbus-roster' }, async ($, e) => {
    const [role, sessionId] = e.args.trim().split(/\s+/)
    if (!isRole(role) || !sessionId) {
      return { text: 'Usage: /devbus-roster <role> <session_id>', isTextDisplayOnly: true }
    }
    await setRosterEntry($, role, sessionId)
    const failures = (await myRole($)) === 'lead' ? await broadcastRoster($) : []
    return {
      text: failures.length ? `Saved; broadcast failed for ${failures.join('; ')}` : `Saved ${role} → ${sessionId}`,
      isTextDisplayOnly: true,
    }
  })

  on('command.run', { command: 'devbus-approve-release' }, async ($, e) => {
    // A person's own gesture only: the model cannot approve a release.
    if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') {
      return { text: 'Only the person can approve a release.', isTextDisplayOnly: true }
    }
    const tag = e.args.trim()
    if (!/^v?\d[\w.\-]*$/.test(tag)) return { text: 'Usage: /devbus-approve-release vX.Y.Z', isTextDisplayOnly: true }
    await update($, approvalsAtom, list => [...new Set([...list, tag])])
    if ((await myRole($)) === 'lead') {
      await sendEnvelope($, { to: 'ops', type: 'STATUS', summary: `Release ${tag} approved by the person.` })
    }
    return { text: `Release ${tag} approved. Ops may tag and publish it.`, isTextDisplayOnly: true }
  })

  on('command.run', { command: 'devbus-usage' }, async $ => ({
    text: usageReport(await read($, usageAtom), config.baselineTokensPerRequest),
    isTextDisplayOnly: true,
  }))

  on('command.run', { command: 'devbus-route' }, async $ => ({ text: await routeOnce($), isTextDisplayOnly: true }))

  // ---- the board pane
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const role = (await read($, roleAtom)) || 'unassigned'
    const current = await read($, currentAtom)
    const roster = await read($, rosterAtom)
    const feed = await read($, feedAtom)
    const now = await $.clock.now()
    const staleMs = config.heartbeatMinutes * config.staleAfterMissedHeartbeats * 60_000
    const room = Math.max(3, (e.viewport?.rows ?? 30) - roster.length - 8)

    return (
      <Box flexDirection="column">
        <Text bold>DevBus · {role}</Text>
        <Text dimColor={!current.task}>
          {current.task
            ? `${current.task} (${current.kind}) ${formatTokens(current.tokens)} / ${formatTokens(current.budget)} tokens`
            : 'idle'}
        </Text>
        <Text bold>Roster</Text>
        {roster.length === 0 && <Text dimColor>No sessions yet.</Text>}
        {roster.map(r => {
          const stale = r.role !== role && r.lastSeen > 0 && now - r.lastSeen > staleMs
          const seen = r.lastSeen ? `${Math.round((now - r.lastSeen) / 60_000)}m` : '-'
          return (
            <Text color={stale ? 'red' : undefined}>
              {`${r.role.padEnd(11)} ${r.task.padEnd(8)} seen ${seen}${stale ? ' STALE' : ''}`}
            </Text>
          )
        })}
        <Text bold>Messages</Text>
        {feed.length === 0 && <Text dimColor>No messages yet.</Text>}
        {feed.slice(-room).map(f => (
          <Text dimColor={f.dir === 'note'}>
            {`${f.dir === 'in' ? '←' : f.dir === 'out' ? '→' : '·'} ${f.type} ${f.peer} ${f.task === '-' ? '' : f.task} ${f.text}`}
          </Text>
        ))}
      </Box>
    )
  })
}
