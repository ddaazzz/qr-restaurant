#!/usr/bin/env node
/**
 * QR Restaurant — Local Print Bridge
 * ====================================
 * Run this script on ANY computer on the same LAN as your network printer.
 * It listens on http://localhost:3001 and forwards ESC/POS bytes over TCP.
 *
 * Usage:
 *   node print-bridge.js
 *   BRIDGE_PORT=3001 node print-bridge.js   (optional custom port)
 *
 * The web admin panel will automatically try to reach this bridge
 * when the backend cannot print directly (e.g. backend is on cloud hosting).
 *
 * No npm install needed — uses only Node.js built-in modules.
 */

'use strict';

const http = require('http');
const net  = require('net');

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
