// DevBus/1 envelope: one header line of key=value pairs, then a short summary.
//
//   [DEVBUS/1] id=<id> type=<TYPE> from=<role> to=<role|*> task=#12 pr=#- sha=- reply=-
//   <summary: at most maxSummaryChars, pointers only>
//
// Optional header keys: budget=<tokens> (TASK), tokens=<n> (DONE/STATUS),
// kind=<request type> (TASK), batch=#1,#2 (TASK for batched size:S work).

export const HEADER = '[DEVBUS/1]'

export const MESSAGE_TYPES = [
  'ROSTER',
  'TASK',
  'ACK',
  'STATUS',
  'BLOCKED',
  'REVIEW_REQ',
  'REVIEW_RESULT',
  'CI_FAIL',
  'ESCALATE',
  'APPROVAL_REQ',
  'DONE',
  'HEARTBEAT',
  'BUDGET',
] as const

export type MessageType = (typeof MESSAGE_TYPES)[number]

export type Envelope = {
  id: string
  type: MessageType
  from: string
  to: string
  task: string
  pr: string
  sha: string
  reply: string
  extra: Record<string, string>
  summary: string
}

const CORE_KEYS = ['id', 'type', 'from', 'to', 'task', 'pr', 'sha', 'reply'] as const

/** Types the receiving mod handles itself: they never reach the model. */
export const CONSUMED_TYPES: readonly MessageType[] = ['ACK', 'HEARTBEAT', 'ROSTER', 'STATUS']

/** Types whose body may be longer than the summary cap (machine data). */
const UNCAPPED: readonly MessageType[] = ['ROSTER']

export function isMessageType(value: string): value is MessageType {
  return (MESSAGE_TYPES as readonly string[]).includes(value)
}

export function newId(now: number, random: () => number = Math.random): string {
  const rand = Math.floor(random() * 0xffffff)
    .toString(36)
    .padStart(5, '0')
  return `${now.toString(36)}${rand}`
}

/** Normalises an issue/PR reference: "12", "#12", "#12,#13" stay readable. */
export function ref(value: string | number | undefined): string {
  if (value === undefined || value === '' || value === '-') return '-'
  const text = String(value).trim()
  return text
    .split(',')
    .map(part => {
      const bare = part.trim().replace(/^#/, '')
      return bare === '' || bare === '-' ? '-' : `#${bare}`
    })
    .join(',')
}

export function format(envelope: Envelope): string {
  const pairs: string[] = [
    `id=${envelope.id}`,
    `type=${envelope.type}`,
    `from=${envelope.from}`,
    `to=${envelope.to}`,
    `task=${envelope.task || '-'}`,
    `pr=${envelope.pr || '-'}`,
    `sha=${envelope.sha || '-'}`,
    `reply=${envelope.reply || '-'}`,
  ]
  for (const [key, value] of Object.entries(envelope.extra)) {
    if (/^[a-z][a-z0-9_-]*$/.test(key) && !/\s/.test(value) && value !== '') {
      pairs.push(`${key}=${value}`)
    }
  }
  const summary = envelope.summary.trim()
  return summary === '' ? `${HEADER} ${pairs.join(' ')}` : `${HEADER} ${pairs.join(' ')}\n${summary}`
}

/** Finds and parses an envelope anywhere in a delivery (the engine may wrap it). */
export function parse(text: string): Envelope | null {
  const start = text.indexOf(HEADER)
  if (start < 0) return null
  const body = text.slice(start + HEADER.length)
  const newline = body.indexOf('\n')
  const headerLine = (newline < 0 ? body : body.slice(0, newline)).trim()
  const summary = newline < 0 ? '' : body.slice(newline + 1).trim()

  const fields: Record<string, string> = {}
  for (const token of headerLine.split(/\s+/)) {
    const eq = token.indexOf('=')
    if (eq <= 0) continue
    fields[token.slice(0, eq)] = token.slice(eq + 1)
  }
  const type = fields.type ?? ''
  if (!fields.id || !isMessageType(type) || !fields.from || !fields.to) return null

  const extra: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (!(CORE_KEYS as readonly string[]).includes(key)) extra[key] = value
  }
  return {
    id: fields.id,
    type,
    from: fields.from,
    to: fields.to,
    task: fields.task ?? '-',
    pr: fields.pr ?? '-',
    sha: fields.sha ?? '-',
    reply: fields.reply ?? '-',
    extra,
    summary,
  }
}

/** Why an envelope may not be sent, or undefined when it may. */
export function validate(envelope: Envelope, maxSummaryChars: number): string | undefined {
  if (!isMessageType(envelope.type)) return `unknown message type "${envelope.type}"`
  if (!envelope.to) return 'missing recipient'
  if (!UNCAPPED.includes(envelope.type) && envelope.summary.length > maxSummaryChars) {
    return (
      `summary is ${envelope.summary.length} chars; the limit is ${maxSummaryChars}. ` +
      'Send pointers (#issue, #pr, sha, path:line), not pasted code or logs.'
    )
  }
  if (/```/.test(envelope.summary)) {
    return 'summary contains a code block. Commit the code and send its path or sha instead.'
  }
  return undefined
}

/** The compact form the receiving model reads instead of the raw envelope. */
export function normalize(envelope: Envelope): string {
  const parts = [`[bus] ${envelope.type} from ${envelope.from}`]
  if (envelope.task !== '-') parts.push(`task ${envelope.task}`)
  if (envelope.pr !== '-') parts.push(`pr ${envelope.pr}`)
  if (envelope.sha !== '-') parts.push(`sha ${envelope.sha}`)
  for (const key of ['kind', 'budget', 'tokens', 'batch']) {
    if (envelope.extra[key]) parts.push(`${key} ${envelope.extra[key]}`)
  }
  const head = `${parts.join(' · ')} (id ${envelope.id}${envelope.reply !== '-' ? `, re ${envelope.reply}` : ''})`
  return envelope.summary ? `${head}\n${envelope.summary}` : head
}

const SECRET_PATTERNS: readonly RegExp[] = [
  /\b(sk-ant-[A-Za-z0-9_-]{10,})/g,
  /\b(gh[pousr]_[A-Za-z0-9]{20,})/g,
  /\b(github_pat_[A-Za-z0-9_]{20,})/g,
  /\b(AKIA[0-9A-Z]{16})\b/g,
  /\b(xox[abprs]-[A-Za-z0-9-]{10,})/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b((?:password|passwd|secret|api[_-]?key|token)\s*[=:]\s*)(\S{6,})/gi,
]

/** Replaces anything that looks like a credential with [redacted]. */
export function scrubSecrets(text: string): { text: string; redactions: number } {
  let redactions = 0
  let out = text
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (...match: string[]) => {
      redactions += 1
      // Keep a "key=" prefix when the pattern captured one.
      return match.length > 3 && /[=:]\s*$/.test(match[1] ?? '') ? `${match[1]}[redacted]` : '[redacted]'
    })
  }
  return { text: out, redactions }
}
