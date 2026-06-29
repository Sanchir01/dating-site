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

function buildMessage(p: DatePayload): string {
  const lines = [
    '💌 *Новое свидание назначено!*',
    '',
    `👤 От кого: ${p.name?.trim() || '—'}`,
    `📍 Место: ${p.place ?? '—'}`,
    `🍽️ Блюдо: ${p.dish ?? '—'}`,
    `🗓️ Когда: ${[p.date?.trim(), p.time].filter(Boolean).join(' в ') || '—'}`,
  ]
  if (p.wishes?.trim()) {
    lines.push('', `📝 Пожелания: ${p.wishes.trim()}`)
  }
  return lines.join('\n')
}

export async function sendTelegram(
  payload: DatePayload,
  env: Env,
): Promise<SendResult> {
  if (!env.token || !env.chatId) {
    return {
      ok: false,
      status: 500,
      error: 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы на сервере',
    }
  }

  const res = await fetch(
    `https://api.telegram.org/bot${env.token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.chatId,
        text: buildMessage(payload),
        parse_mode: 'Markdown',
      }),
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return { ok: false, status: 502, error: `Telegram API: ${res.status} ${detail}` }
  }

  return { ok: true, status: 200 }
}
