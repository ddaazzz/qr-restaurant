#!/usr/bin/env node
/**
 * QR Restaurant — Local Print Bridge
 * ====================================
 * Run this script on ANY computer on the same LAN as your network printer.
 * It listens on https://localhost:3001 and forwards ESC/POS bytes over TCP.
 *
 * Usage:
 *   node print-bridge.js
 *   BRIDGE_PORT=3001 node print-bridge.js   (optional custom port)
 *
 * FIRST-TIME SETUP (one-time, per browser):
 *   The bridge uses a self-signed HTTPS certificate so that Safari and other
 *   browsers allow it to be called from the HTTPS admin panel.
 *   On first run a certificate is generated in ~/.qr-bridge/
 *
 *   macOS — add to system keychain (run once, then restart the bridge):
 *     sudo security add-trusted-cert -d -r trustRoot \
 *       -k /Library/Keychains/System.keychain ~/.qr-bridge/cert.pem
 *
 *   All browsers — manual trust:
 *     1. Open https://localhost:3001 in your browser
 *     2. Click through the "not secure" / "Show Details" warning
 *     3. After trusting, printing will work immediately — no restart needed
 *
 * No npm install needed — uses only Node.js built-in modules.
 */

'use strict';

const https  = require('https');
const net    = require('net');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');
const { spawnSync } = require('child_process');

const PORT      = parseInt(process.env.BRIDGE_PORT || '3001', 10);
const CERT_DIR  = path.join(os.homedir(), '.qr-bridge');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE  = path.join(CERT_DIR, 'key.pem');

// ── Certificate helpers ───────────────────────────────────────────────────────

function generateCert() {
  fs.mkdirSync(CERT_DIR, { recursive: true });

  // Write a minimal openssl config that includes SAN (required by Chrome/Safari)
  const cfgFile = path.join(CERT_DIR, 'openssl.cnf');
  fs.writeFileSync(cfgFile, [
    '[req]',
    'distinguished_name = req_dn',
    'x509_extensions    = v3_ca',
    'prompt             = no',
    '[req_dn]',
    'CN = localhost',
    '[v3_ca]',
    'subjectAltName   = @san',
    'basicConstraints = CA:true',
    '[san]',
    'IP.1  = 127.0.0.1',
    'DNS.1 = localhost',
  ].join('\n'));

  console.log('[Bridge] Generating self-signed HTTPS certificate…');
  const result = spawnSync('openssl', [
    'req', '-x509',
    '-newkey', 'rsa:2048',
    '-keyout', KEY_FILE,
    '-out',    CERT_FILE,
    '-days',   '3650',
    '-nodes',
    '-config', cfgFile,
  ], { stdio: 'pipe' });

  if (result.status !== 0) {
    const msg = result.stderr ? result.stderr.toString() : 'unknown error';
    throw new Error(`openssl failed: ${msg}`);
  }
  console.log(`[Bridge] Certificate saved to ${CERT_DIR}`);
}

function ensureCert() {
  if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
    generateCert();
  }
  return {
    cert: fs.readFileSync(CERT_FILE),
    key:  fs.readFileSync(KEY_FILE),
  };
}

// ── TCP helper ────────────────────────────────────────────────────────────────

function sendToTcp(host, port, dataBuffer, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      if (err) reject(err); else resolve();
    };

    const socket = net.createConnection({ host, port: parseInt(port, 10) }, () => {
      socket.write(dataBuffer, (writeErr) => {
        if (writeErr) { socket.destroy(); return done(writeErr); }
        socket.end();
        done();
      });
    });

    const timer = setTimeout(() => {
      socket.destroy();
      done(new Error(`TCP connection to ${host}:${port} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.on('connect', () => clearTimeout(timer));
    socket.on('error',   (err) => { clearTimeout(timer); socket.destroy(); done(err); });
    socket.on('close',   ()    => { clearTimeout(timer); done(); });
  });
}

// ── HTTPS request handler ─────────────────────────────────────────────────────

function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health / trust check — browser visits this URL to accept the cert
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body style="font-family:sans-serif;padding:2em">' +
      '<h2>✅ QR Restaurant Print Bridge is running</h2>' +
      '<p>This page is only used to trust the HTTPS certificate.<br>' +
      'You can close this tab and return to the admin panel.</p>' +
      '</body></html>');
    return;
  }

  // Print endpoint
  if (req.method === 'POST' && req.url === '/print-escpos') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      let host, port, escposBase64;
      try {
        ({ host, port, escposBase64 } = JSON.parse(body));
        if (!host || !port || !escposBase64) throw new Error('Missing host, port, or escposBase64');
      } catch (parseErr) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Bad request: ${parseErr.message}` }));
        return;
      }

      try {
        const data = Buffer.from(escposBase64, 'base64');
        await sendToTcp(host, port, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        console.log(`[${ts()}] ✓ Sent ${data.length} bytes → ${host}:${port}`);
      } catch (printErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: printErr.message }));
        console.error(`[${ts()}] ✗ Print error (${host}:${port}): ${printErr.message}`);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
}

// ── Start ─────────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

let tlsOptions;
try {
  tlsOptions = ensureCert();
} catch (certErr) {
  console.error('\n❌ Failed to generate HTTPS certificate:', certErr.message);
  console.error('   Make sure openssl is installed (macOS: brew install openssl)\n');
  process.exit(1);
}

const server = https.createServer(tlsOptions, handleRequest);

server.listen(PORT, '127.0.0.1', () => {
  const isMac = process.platform === 'darwin';
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  QR Restaurant — Print Bridge v2.0 (HTTPS)                  ║`);
  console.log(`║  Listening on https://localhost:${PORT}                         ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  FIRST-TIME SETUP — trust the certificate (once per browser) ║');
  console.log('║                                                              ║');
  if (isMac) {
    console.log('║  Option A — system-wide auto-trust (needs sudo, run once):  ║');
    console.log('║    sudo security add-trusted-cert -d -r trustRoot \\        ║');
    console.log('║      -k /Library/Keychains/System.keychain \\               ║');
    console.log(`║      ${CERT_FILE.slice(0, 54).padEnd(54)}║`);
    console.log('║                                                              ║');
  }
  console.log('║  Option B — manual trust in browser (all platforms):         ║');
  console.log(`║    1. Open https://localhost:${PORT} in your browser             ║`);
  console.log('║    2. Click "Show Details" → "visit this website" / "Trust"  ║');
  console.log('║    3. Return to the admin panel — printing will work now      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[${ts()}] Ready — waiting for print jobs…`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use. Is the bridge already running?`);
    console.error(`   Try: BRIDGE_PORT=3002 node print-bridge.js\n`);
  } else {
    console.error('\n❌ Server error:', err.message);
  }
  process.exit(1);
});


const PORT = parseInt(process.env.BRIDGE_PORT || '3001', 10);

// ── TCP helper ────────────────────────────────────────────────────────────────

function sendToTcp(host, port, dataBuffer, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      if (err) reject(err); else resolve();
    };

    const socket = net.createConnection({ host, port: parseInt(port, 10) }, () => {
      socket.write(dataBuffer, (writeErr) => {
        if (writeErr) { socket.destroy(); return done(writeErr); }
        socket.end();
        done();
      });
    });

    const timer = setTimeout(() => {
      socket.destroy();
      done(new Error(`TCP connection to ${host}:${port} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.on('connect', () => clearTimeout(timer));
    socket.on('error',   (err) => { clearTimeout(timer); socket.destroy(); done(err); });
    socket.on('close',   ()    => { clearTimeout(timer); done(); });
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // CORS — allow the webapp origin (or any origin since this is localhost-only)
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'print-bridge', version: '1.0' }));
    return;
  }

  // Print endpoint
  if (req.method === 'POST' && req.url === '/print-escpos') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      let host, port, escposBase64;
      try {
        ({ host, port, escposBase64 } = JSON.parse(body));
        if (!host || !port || !escposBase64) throw new Error('Missing host, port, or escposBase64');
      } catch (parseErr) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Bad request: ${parseErr.message}` }));
        return;
      }

      try {
        const data = Buffer.from(escposBase64, 'base64');
        await sendToTcp(host, port, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        console.log(`[${ts()}] ✓ Sent ${data.length} bytes → ${host}:${port}`);
      } catch (printErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: printErr.message }));
        console.error(`[${ts()}] ✗ Print error (${host}:${port}): ${printErr.message}`);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

// ── Start ─────────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log(`║  QR Restaurant — Print Bridge v1.0       ║`);
  console.log(`║  Listening on http://localhost:${PORT}      ║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Keep this window open while using the   ║');
  console.log('║  web admin panel to print.               ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`[${ts()}] Ready — waiting for print jobs...`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use. Is the bridge already running?`);
    console.error(`   Try: BRIDGE_PORT=3002 node print-bridge.js\n`);
  } else {
    console.error('\n❌ Server error:', err.message);
  }
  process.exit(1);
});
