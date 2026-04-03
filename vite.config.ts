import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ---- 玩家数据 API 插件 ----
// 数据文件: data/players.json（可直接编辑）
// 格式: [{ wallet, domain, level, remove3, undo, shuffle }]
function playerApiPlugin(): Plugin {
  const dataDir = path.resolve(__dirname, 'data')
  const dataFile = path.join(dataDir, 'players.json')

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]', 'utf-8')

  // 写入串行化（防止并发写入冲突）
  let writeQueue: Promise<void> = Promise.resolve()

  function readPlayers(): Record<string, unknown>[] {
    try { return JSON.parse(fs.readFileSync(dataFile, 'utf-8')) }
    catch { return [] }
  }

  function writePlayers(players: Record<string, unknown>[]) {
    const tmp = dataFile + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(players, null, 2), 'utf-8')
    fs.renameSync(tmp, dataFile)
  }

  function serializedWrite(fn: () => void): Promise<void> {
    const task = writeQueue.then(fn).catch(e => console.error('[PlayerAPI]', e))
    writeQueue = task
    return task
  }

  return {
    name: 'player-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''

        // GET /api/players
        if (url === '/api/players' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(readPlayers()))
          return
        }

        // GET /api/player/:wallet
        const getMatch = url.match(/^\/api\/player\/([A-Za-z0-9]+)$/)
        if (getMatch && req.method === 'GET') {
          const wallet = getMatch[1]
          const player = readPlayers().find(p => p.wallet === wallet)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(player || null))
          return
        }

        // POST /api/player/:wallet
        const postMatch = url.match(/^\/api\/player\/([A-Za-z0-9]+)$/)
        if (postMatch && req.method === 'POST') {
          const wallet = postMatch[1]
          let body = ''
          req.on('data', (chunk: Buffer) => { body += chunk.toString() })
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              await serializedWrite(() => {
                const players = readPlayers()
                const idx = players.findIndex(p => p.wallet === wallet)
                if (idx >= 0) {
                  if (data.domain !== undefined) players[idx].domain = data.domain
                  if (data.level !== undefined) players[idx].level = data.level
                  if (data.remove3 !== undefined) players[idx].remove3 = data.remove3
                  if (data.undo !== undefined) players[idx].undo = data.undo
                  if (data.shuffle !== undefined) players[idx].shuffle = data.shuffle
                  if (data.lastSpinAt !== undefined) players[idx].lastSpinAt = data.lastSpinAt
                } else {
                  players.push({
                    wallet,
                    domain: data.domain || '',
                    level: data.level || 1,
                    remove3: data.remove3 || 0,
                    undo: data.undo || 0,
                    shuffle: data.shuffle || 0,
                    lastSpinAt: data.lastSpinAt || 0,
                  })
                }
                writePlayers(players)
              })
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid JSON' }))
            }
          })
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [
    playerApiPlugin(),
    nodePolyfills({
      include: ['buffer', 'process', 'stream', 'util'],
      globals: { Buffer: true, global: true, process: true },
    }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Solana Match',
        short_name: 'SKR Match',
        description: 'A Web3 puzzle game on Solana',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
  ],
  server: {
    watch: {
      ignored: ['**/data/**'],
    },
  },
})
