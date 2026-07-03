import { defineConfig, loadEnv, type Plugin } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { sendTelegram, type DatePayload } from './server/sendTelegram.js'

// Dev-only middleware so POST /api/send-telegram works under `npm run dev`.
// In production this same logic lives in the serverless function api/send-telegram.ts
function telegramDevApi(env: Record<string, string>): Plugin {
  return {
    name: 'telegram-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/send-telegram', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = JSON.parse(Buffer.concat(chunks).toString() || '{}') as DatePayload

          const result = await sendTelegram(body, {
            token: env.TELEGRAM_BOT_TOKEN,
            chatId: env.TELEGRAM_CHAT_ID,
          })
          res.statusCode = result.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(result))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ ok: false, error: String(e) }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // load .env including non-VITE_ vars (server-only secrets)
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      telegramDevApi(env),
    ],
  }
})
