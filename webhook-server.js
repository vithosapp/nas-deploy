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

http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/deploy') {
    res.writeHead(404).end();
    return;
  }

  const provided = req.headers['x-deploy-secret'] || '';
  if (!secretsMatch(provided, SECRET)) {
    res.writeHead(401).end('unauthorized');
    return;
  }

  res.writeHead(202).end('deploy triggered');

  exec(DEPLOY_SCRIPT, { shell: SHELL }, (err, stdout, stderr) => {
    if (err) console.error('deploy failed:', err.message, stderr);
    else console.log('deploy finished:', stdout);
  });
}).listen(PORT, () => console.log(`webhook listener on :${PORT}`));
