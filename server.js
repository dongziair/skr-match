/**
 * server.js
 * 生产环境服务器：静态文件 + 玩家数据 API
 * 启动: node server.js
 * 数据文件: data/players.json（可手动编辑）
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ---- 数据文件 ----
const dataDir = path.resolve(__dirname, 'data');
const dataFile = path.join(dataDir, 'players.json');
const reportsFile = path.join(dataDir, 'reports.json');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]', 'utf-8');
if (!fs.existsSync(reportsFile)) fs.writeFileSync(reportsFile, '[]', 'utf-8');

// 写入串行化
let writeQueue = Promise.resolve();

function readPlayers() {
  try { return JSON.parse(fs.readFileSync(dataFile, 'utf-8')); }
  catch { return []; }
}

function readReports() {
  try { return JSON.parse(fs.readFileSync(reportsFile, 'utf-8')); }
  catch { return []; }
}

function writePlayers(players) {
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(players, null, 2), 'utf-8');
  fs.renameSync(tmp, dataFile);
}

function writeReports(reports) {
  const tmp = reportsFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(reports, null, 2), 'utf-8');
  fs.renameSync(tmp, reportsFile);
}

function serializedWrite(fn) {
  const task = writeQueue.then(fn).catch(e => console.error('[PlayerAPI]', e));
  writeQueue = task;
  return task;
}

function isWalletLike(value) {
  return typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function cleanText(value, maxLength = 120) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function decodeBase58(value) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let bytes = [0];

  for (const char of value) {
    const carryStart = alphabet.indexOf(char);
    if (carryStart < 0) return null;
    let carry = carryStart;
    for (let i = 0; i < bytes.length; i++) {
      const x = bytes[i] * 58 + carry;
      bytes[i] = x & 0xff;
      carry = x >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (const char of value) {
    if (char !== '1') break;
    bytes.push(0);
  }

  return Buffer.from(bytes.reverse());
}

function verifyWalletSignature(wallet, message, signature) {
  try {
    if (!isWalletLike(wallet) || message !== `SKR Match delete data request for wallet ${wallet}`) {
      return false;
    }
    if (!Array.isArray(signature) || signature.length !== 64) return false;

    const publicKey = decodeBase58(wallet);
    if (!publicKey || publicKey.length !== 32) return false;

    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
    const key = crypto.createPublicKey({
      key: Buffer.concat([spkiPrefix, publicKey]),
      format: 'der',
      type: 'spki',
    });

    return crypto.verify(
      null,
      Buffer.from(message, 'utf-8'),
      key,
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

// ---- API 路由 ----
app.use(express.json());

app.get('/api/players', (_req, res) => {
  const players = readPlayers()
    .map(p => ({
      wallet: p.wallet,
      domain: cleanText(p.domain || ''),
      level: Number(p.level) || 1,
    }))
    .sort((a, b) => b.level - a.level)
    .slice(0, 50);
  res.json(players);
});

app.get('/api/player/:wallet', (req, res) => {
  const player = readPlayers().find(p => p.wallet === req.params.wallet);
  res.json(player || null);
});

app.post('/api/player/:wallet', async (req, res) => {
  const { wallet } = req.params;
  if (!isWalletLike(wallet)) {
    res.status(400).json({ error: 'Invalid wallet' });
    return;
  }
  const data = req.body;
  await serializedWrite(() => {
    const players = readPlayers();
    const idx = players.findIndex(p => p.wallet === wallet);
    if (idx >= 0) {
      if (data.domain !== undefined) players[idx].domain = cleanText(data.domain, 80);
      if (data.level !== undefined) players[idx].level = Math.max(1, Math.min(Number(data.level) || 1, 20));
      if (data.remove3 !== undefined) players[idx].remove3 = Math.max(0, Number(data.remove3) || 0);
      if (data.undo !== undefined) players[idx].undo = Math.max(0, Number(data.undo) || 0);
      if (data.shuffle !== undefined) players[idx].shuffle = Math.max(0, Number(data.shuffle) || 0);
      if (data.lastSpinAt !== undefined) players[idx].lastSpinAt = Math.max(0, Number(data.lastSpinAt) || 0);
    } else {
      players.push({
        wallet,
        domain: cleanText(data.domain || '', 80),
        level: Math.max(1, Math.min(Number(data.level) || 1, 20)),
        remove3: Math.max(0, Number(data.remove3) || 0),
        undo: Math.max(0, Number(data.undo) || 0),
        shuffle: Math.max(0, Number(data.shuffle) || 0),
        lastSpinAt: Math.max(0, Number(data.lastSpinAt) || 0),
      });
    }
    writePlayers(players);
  });
  res.json({ ok: true });
});

app.delete('/api/player/:wallet', async (req, res) => {
  const { wallet } = req.params;
  if (!isWalletLike(wallet)) {
    res.status(400).json({ error: 'Invalid wallet' });
    return;
  }
  if (!verifyWalletSignature(wallet, req.body?.message, req.body?.signature)) {
    res.status(401).json({ error: 'Wallet signature required' });
    return;
  }

  await serializedWrite(() => {
    writePlayers(readPlayers().filter(p => p.wallet !== wallet));
  });
  res.json({ ok: true });
});

app.post('/api/report', async (req, res) => {
  const report = {
    reporterWallet: isWalletLike(req.body?.reporterWallet) ? req.body.reporterWallet : '',
    reportedWallet: isWalletLike(req.body?.reportedWallet) ? req.body.reportedWallet : '',
    displayName: cleanText(req.body?.displayName, 80),
    reason: cleanText(req.body?.reason, 160),
    createdAt: new Date().toISOString(),
  };

  if (!report.reportedWallet) {
    res.status(400).json({ error: 'Invalid reported wallet' });
    return;
  }

  await serializedWrite(() => {
    const reports = readReports();
    reports.push(report);
    writeReports(reports.slice(-500));
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
