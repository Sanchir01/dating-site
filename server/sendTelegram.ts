// Shared Telegram-sending logic. Runs ONLY on the server (Vite dev middleware
// in development, serverless function in production). The bot token never
// reaches the browser bundle.

export type DatePayload = {
  name?: string
  wishes?: string
  date?: string
  place?: string
  dish?: string
  time?: string
}

export type Env = {
  token?: string
  chatId?: string
}

export type SendResult = {
  ok: boolean
  status: number
  error?: string
}

// Захардкожено сознательно: сайт живёт один день. После — отозвать токен
// через @BotFather (/revoke). Env-переменные, если заданы, имеют приоритет.
const FALLBACK_TOKEN = '8430097887:AAEG5yUXlNefLnItY1pMCA5qnz9QLFupiQs'
const FALLBACK_CHAT_ID = '1195173283'

// Escape user-controlled text for Telegram parse_mode: 'HTML'.
// Only &, <, > are special — unlike Markdown, so names/wishes with
// characters like _ * [ ( ` pass through safely.
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildMessage(p: DatePayload): string {
  const when = [p.date?.trim(), p.time].filter(Boolean).join(' в ') || '—'
  const lines = [
    '💌 <b>Новое свидание назначено!</b>',
    '',
    `👤 От кого: ${esc(p.name?.trim() || '—')}`,
    `📍 Место: ${esc(p.place ?? '—')}`,
    `🍽️ Блюдо: ${esc(p.dish ?? '—')}`,
    `🗓️ Когда: ${esc(when)}`,
  ]
  if (p.wishes?.trim()) {
    lines.push('', `📝 Пожелания: ${esc(p.wishes.trim())}`)
  }
  return lines.join('\n')
}

export async function sendTelegram(
  payload: DatePayload,
  env: Env,
): Promise<SendResult> {
  const token = env.token || FALLBACK_TOKEN
  const chatId = env.chatId || FALLBACK_CHAT_ID

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(payload),
        parse_mode: 'HTML',
      }),
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return { ok: false, status: 502, error: `Telegram API: ${res.status} ${detail}` }
  }

  return { ok: true, status: 200 }
}
