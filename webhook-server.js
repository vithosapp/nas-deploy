const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.DEPLOY_SECRET;
const DEPLOY_SCRIPT = process.env.DEPLOY_SCRIPT || `${process.env.HOME}/nas/nas-deploy/deploy.sh`;
const SHELL = process.env.PREFIX ? `${process.env.PREFIX}/bin/sh` : '/bin/sh';

if (!SECRET) {
  console.error('DEPLOY_SECRET env var is required');
  process.exit(1);
}

function secretsMatch(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isAuthorized(req) {
  return secretsMatch(req.headers['x-deploy-secret'] || '', SECRET);
}

function run(cmd) {
  return new Promise((resolve) => {
    exec(cmd, { shell: SHELL, timeout: 10 * 1000 }, (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  });
}

async function getStats() {
  const [batteryRaw, dfRaw, loadavgRaw, freeRaw] = await Promise.all([
    run('termux-battery-status'),
    run(`df -k ${process.env.HOME}`),
    run('cat /proc/loadavg'),
    run('free -k'),
  ]);

  let battery = null;
  if (batteryRaw) {
    try {
      battery = JSON.parse(batteryRaw);
    } catch {
      battery = null;
    }
  }

  let storage = null;
  const dfLine = dfRaw && dfRaw.split('\n')[1];
  if (dfLine) {
    const parts = dfLine.trim().split(/\s+/);
    storage = {
      totalMB: Math.round(Number(parts[1]) / 1024),
      usedMB: Math.round(Number(parts[2]) / 1024),
      availableMB: Math.round(Number(parts[3]) / 1024),
      usePercent: parts[4],
    };
  }

  let load = null;
  if (loadavgRaw) {
    const [one, five, fifteen] = loadavgRaw.split(' ');
    load = { '1m': Number(one), '5m': Number(five), '15m': Number(fifteen) };
  }

  let memory = null;
  const freeLine = freeRaw && freeRaw.split('\n')[1];
  if (freeLine) {
    const parts = freeLine.trim().split(/\s+/);
    memory = {
      totalMB: Math.round(Number(parts[1]) / 1024),
      usedMB: Math.round(Number(parts[2]) / 1024),
      freeMB: Math.round(Number(parts[3]) / 1024),
    };
  }

  return { battery, storage, memory, load, timestamp: new Date().toISOString() };
}

http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/stats') {
    if (!isAuthorized(req)) {
      res.writeHead(401).end('unauthorized');
      return;
    }
    getStats().then((stats) => {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(stats));
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/deploy') {
    if (!isAuthorized(req)) {
      res.writeHead(401).end('unauthorized');
      return;
    }
    exec(
      DEPLOY_SCRIPT,
      { shell: SHELL, maxBuffer: 10 * 1024 * 1024, timeout: 5 * 60 * 1000 },
      (err, stdout, stderr) => {
        if (err) {
          console.error('deploy failed:', err.message, stderr);
          res.writeHead(500, { 'Content-Type': 'text/plain' }).end(`deploy failed:\n${stdout}\n${stderr}`);
          return;
        }
        console.log('deploy finished:', stdout);
        res.writeHead(200, { 'Content-Type': 'text/plain' }).end(`deploy succeeded:\n${stdout}`);
      }
    );
    return;
  }

  res.writeHead(404).end();
}).listen(PORT, () => console.log(`webhook listener on :${PORT}`));
