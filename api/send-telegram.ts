// Production serverless endpoint (Vercel / similar). Reads the bot token from
// server env vars — it is never shipped to the browser.
import { sendTelegram, type DatePayload } from '../server/sendTelegram.js'

// Web-standard (Request → Response) handler — requires the Edge runtime on Vercel.
// On the default Node runtime the returned Response is ignored and the request hangs.
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body: DatePayload
  try {
    body = (await req.json()) as DatePayload
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = await sendTelegram(body, {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  })

  return new Response(JSON.stringify(result), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
