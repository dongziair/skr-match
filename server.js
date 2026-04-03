/**
 * server.js
 * 生产环境服务器：静态文件 + 玩家数据 API
 * 启动: node server.js
 * 数据文件: data/players.json（可手动编辑）
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ---- 数据文件 ----
const dataDir = path.resolve(__dirname, 'data');
const dataFile = path.join(dataDir, 'players.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]', 'utf-8');

// 写入串行化
let writeQueue = Promise.resolve();

function readPlayers() {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf-8')); }
  catch { return []; }
}

function writePlayers(players) {
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(players, null, 2), 'utf-8');
  fs.renameSync(tmp, dataFile);
}

function serializedWrite(fn) {
  const task = writeQueue.then(fn).catch(e => console.error('[PlayerAPI]', e));
  writeQueue = task;
  return task;
}

// ---- API 路由 ----
app.use(express.json());

app.get('/api/players', (_req, res) => {
  res.json(readPlayers());
});

app.get('/api/player/:wallet', (req, res) => {
  const player = readPlayers().find(p => p.wallet === req.params.wallet);
  res.json(player || null);
});

app.post('/api/player/:wallet', async (req, res) => {
  const { wallet } = req.params;
  const data = req.body;
  await serializedWrite(() => {
    const players = readPlayers();
    const idx = players.findIndex(p => p.wallet === wallet);
    if (idx >= 0) {
      if (data.domain !== undefined) players[idx].domain = data.domain;
      if (data.level !== undefined) players[idx].level = data.level;
      if (data.remove3 !== undefined) players[idx].remove3 = data.remove3;
      if (data.undo !== undefined) players[idx].undo = data.undo;
      if (data.shuffle !== undefined) players[idx].shuffle = data.shuffle;
    } else {
      players.push({
        wallet,
        domain: data.domain || '',
        level: data.level || 1,
        remove3: data.remove3 || 0,
        undo: data.undo || 0,
        shuffle: data.shuffle || 0,
      });
    }
    writePlayers(players);
  });
  res.json({ ok: true });
});

// ---- 静态文件（Vite build 输出） ----
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[SKR Match] Server running on http://localhost:${PORT}`);
  console.log(`[SKR Match] Player data: ${dataFile}`);
});
