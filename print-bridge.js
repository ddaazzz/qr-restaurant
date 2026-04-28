#!/usr/bin/env node
/**
 * QR Restaurant — Local Print Bridge v5.0
 * =========================================
 * Two servers run simultaneously:
 *
 *   1. HTTPS on localhost:3001  — webapp print bridge (POST /print-escpos)
 *   2. Raw TCP on 0.0.0.0:9100 — network printer emulator for iOS/iPad on LAN
 *      The iPad connects to <Mac's LAN IP>:9100 and sends raw ESC/POS bytes,
 *      exactly like a real Epson network printer. Data is forwarded to the USB
 *      printer via libusb (bypasses broken CUPS on macOS Sonoma).
 *
 * Usage:
 *   node print-bridge.js
 *
 * First-time browser trust (for webapp):
 *   Open https://localhost:3001 and click through the security warning once.
 *
 * For iOS/iPad:
 *   Set printer host = <this Mac's LAN IP>, port = 9100 in the app settings.
 *
 * Requires: npm install usb  (already done)
 */

'use strict';

const https   = require('https');
const net     = require('net');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const { spawnSync } = require('child_process');

// USB direct printing (bypasses CUPS which is broken on macOS Sonoma for raw USB printers)
let usbLib = null;
try { usbLib = require('usb'); } catch (_) { /* usb package not installed */ }

const PORT      = parseInt(process.env.BRIDGE_PORT || '3001', 10);
const TCP_PORT  = parseInt(process.env.PRINTER_TCP_PORT || '9100', 10);
const CERT_DIR  = path.join(os.homedir(), '.qr-bridge');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE  = path.join(CERT_DIR, 'key.pem');

// Get the Mac's primary LAN IP (first non-loopback IPv4)
function getLanIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

// ── Certificate ───────────────────────────────────────────────────────────────

function generateCert() {
  fs.mkdirSync(CERT_DIR, { recursive: true });
  const cfgFile = path.join(CERT_DIR, 'openssl.cnf');
  fs.writeFileSync(cfgFile, [
    '[req]', 'distinguished_name = req_dn', 'x509_extensions = v3_ca', 'prompt = no',
    '[req_dn]', 'CN = localhost',
    '[v3_ca]', 'subjectAltName = @san', 'basicConstraints = CA:true',
    '[san]', 'IP.1 = 127.0.0.1', 'DNS.1 = localhost',
  ].join('\n'));
  console.log('[Bridge] Generating self-signed HTTPS certificate…');
  const r = spawnSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048',
    '-keyout', KEY_FILE, '-out', CERT_FILE,
    '-days', '3650', '-nodes', '-config', cfgFile,
  ], { stdio: 'pipe' });
  if (r.status !== 0) throw new Error(`openssl failed: ${r.stderr ? r.stderr.toString() : 'unknown'}`);
  console.log(`[Bridge] Certificate saved to ${CERT_DIR}`);
}

function ensureCert() {
  if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) generateCert();
  return { cert: fs.readFileSync(CERT_FILE), key: fs.readFileSync(KEY_FILE) };
}

// ── TCP helper ────────────────────────────────────────────────────────────────

function sendToTcp(host, port, dataBuffer, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err) => { if (settled) return; settled = true; err ? reject(err) : resolve(); };
    const socket = net.createConnection({ host, port: parseInt(port, 10) }, () => {
      socket.write(dataBuffer, (e) => {
        if (e) { socket.destroy(); return done(e); }
        socket.end(); done();
      });
    });
    const timer = setTimeout(() => { socket.destroy(); done(new Error(`TCP timed out (${host}:${port})`)); }, timeoutMs);
    socket.on('connect', () => clearTimeout(timer));
    socket.on('error',   (e) => { clearTimeout(timer); socket.destroy(); done(e); });
    socket.on('close',   ()  => { clearTimeout(timer); done(); });
  });
}

// ── Direct USB helper (libusb) ────────────────────────────────────────────────

// Known Epson POS printer USB IDs
const EPSON_USB_PRINTERS = [
  { vendorId: 0x04b8, productId: 0x0202, name: 'Epson TM-T88IV (UB-U02III)' },
  { vendorId: 0x04b8, productId: 0x0005, name: 'Epson TM-T88V' },
  { vendorId: 0x04b8, productId: 0x0e28, name: 'Epson TM-T88VI' },
];

function listUsbPrinters() {
  if (!usbLib) return [];
  const found = [];
  for (const def of EPSON_USB_PRINTERS) {
    const dev = usbLib.findByIds(def.vendorId, def.productId);
    if (dev) found.push(def.name);
  }
  return found;
}

function sendToUsbDirect(dataBuffer) {
  return new Promise((resolve, reject) => {
    if (!usbLib) return reject(new Error('usb package not available'));

    let device = null;
    for (const def of EPSON_USB_PRINTERS) {
      device = usbLib.findByIds(def.vendorId, def.productId);
      if (device) break;
    }
    if (!device) return reject(new Error('No supported USB printer found'));

    try {
      device.open();
    } catch (e) {
      return reject(new Error(`Cannot open USB device: ${e.message}`));
    }

    let iface;
    try {
      iface = device.interface(0);
      // On macOS, detachKernelDriver may throw if no kernel driver — that's fine
      try { iface.detachKernelDriver(); } catch (_) {}
      iface.claim();
    } catch (e) {
      try { device.close(); } catch (_) {}
      return reject(new Error(`Cannot claim USB interface: ${e.message}`));
    }

    const outEndpoint = iface.endpoints.find(ep => ep.direction === 'out' && ep.transferType === 2 /* BULK */);
    if (!outEndpoint) {
      try { iface.release(true, () => device.close()); } catch (_) {}
      return reject(new Error('No bulk-out endpoint found on USB printer'));
    }

    outEndpoint.transfer(dataBuffer, (err) => {
      iface.release(true, () => {
        try { device.close(); } catch (_) {}
        if (err) reject(new Error(`USB transfer error: ${err.message}`));
        else resolve();
      });
    });
  });
}

// ── HTTPS handler ─────────────────────────────────────────────────────────────

function ts() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Health / cert-trust page
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    const printers = listUsbPrinters();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      '<html><body style="font-family:sans-serif;padding:2em">' +
      '<h2>✅ QR Restaurant Print Bridge is running</h2>' +
      '<p>Certificate trusted. You can close this tab and return to the admin panel.</p>' +
      (printers.length > 0
        ? `<p>🖨 USB printers: <b>${printers.join(', ')}</b></p>`
        : '<p>⚠️ No USB printers detected. Connect printer via USB, then add it in System Settings → Printers &amp; Scanners.</p>') +
      '</body></html>'
    );
    return;
  }

  // List CUPS printers
  if (req.method === 'GET' && req.url === '/printers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ printers: listUsbPrinters() }));
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
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Bad request: ${e.message}` }));
        return;
      }

      const data = Buffer.from(escposBase64, 'base64');

      // 1. Try TCP
      try {
        await sendToTcp(host, port, data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, method: 'tcp' }));
        console.log(`[${ts()}] ✓ TCP: ${data.length}B → ${host}:${port}`);
        return;
      } catch (tcpErr) {
        console.warn(`[${ts()}] ⚠ TCP failed (${host}:${port}): ${tcpErr.message} — trying USB…`);
      }

      // 2. USB direct fallback
      const usbPrinters = listUsbPrinters();
      if (usbPrinters.length === 0) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: `TCP to ${host}:${port} failed and no USB printer found. ` +
                 `Connect Epson printer via USB cable.`,
        }));
        console.error(`[${ts()}] ✗ No USB printers found. TCP to ${host}:${port} also failed.`);
        return;
      }

      try {
        await sendToUsbDirect(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, method: 'usb', printer: usbPrinters[0] }));
        console.log(`[${ts()}] ✓ USB: ${data.length}B → ${usbPrinters[0]}`);
      } catch (usbErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: usbErr.message }));
        console.error(`[${ts()}] ✗ USB error: ${usbErr.message}`);
      }
    });
    return;
  }

  res.writeHead(404); res.end();
}

// ── Start ─────────────────────────────────────────────────────────────────────

let tlsOptions;
try {
  tlsOptions = ensureCert();
} catch (e) {
  console.error('\n❌ Failed to generate HTTPS certificate:', e.message);
  process.exit(1);
}

// ── 1. HTTPS server (webapp bridge, localhost only) ───────────────────────────
const server = https.createServer(tlsOptions, handleRequest);

server.listen(PORT, '127.0.0.1', () => {
  // Startup banner printed after both servers start (see TCP server callback below)
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} already in use. Try: BRIDGE_PORT=3002 node print-bridge.js\n`);
  } else {
    console.error('\n❌ HTTPS server error:', err.message);
  }
  process.exit(1);
});

// ── 2. Raw TCP server (network printer emulator, LAN-accessible) ──────────────
// Accepts ESC/POS bytes on port 9100 — same protocol as a real Epson LAN printer.
// iPad/iOS app connects here using the Mac's LAN IP as the "printer host".
const tcpServer = net.createServer((socket) => {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[${ts()}] TCP connection from ${remote}`);

  const chunks = [];
  socket.on('data', (chunk) => { chunks.push(chunk); });

  socket.on('end', async () => {
    const data = Buffer.concat(chunks);
    if (data.length === 0) {
      console.log(`[${ts()}] TCP: empty payload from ${remote}, ignoring`);
      return;
    }
    console.log(`[${ts()}] TCP: ${data.length}B received from ${remote} — forwarding to USB…`);
    try {
      await sendToUsbDirect(data);
      console.log(`[${ts()}] ✓ TCP→USB: ${data.length}B printed`);
    } catch (err) {
      console.error(`[${ts()}] ✗ TCP→USB error: ${err.message}`);
    }
  });

  socket.on('error', (err) => {
    console.error(`[${ts()}] TCP socket error (${remote}): ${err.message}`);
  });
});

tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
  const lanIP     = getLanIP();
  const usbPrinters = listUsbPrinters();
  const printerStr  = (usbPrinters.join(', ') || 'none').slice(0, 38).padEnd(38);
  const ipStr       = `${lanIP}:${TCP_PORT}`.padEnd(38);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  QR Restaurant — Print Bridge v5.0                      ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Webapp  (HTTPS) → https://localhost:${PORT}               ║`);
  console.log(`║  iPad/iOS (TCP)  → ${ipStr}║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  USB printer: ${printerStr.slice(0,43).padEnd(43)}║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  iOS/iPad setup:                                         ║');
  console.log(`║    Printer Host = ${lanIP.padEnd(39)}║`);
  console.log(`║    Printer Port = ${String(TCP_PORT).padEnd(39)}║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Trust cert (webapp): open https://localhost:3001        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`[${ts()}] Ready — waiting for print jobs…`);
});

tcpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ TCP port ${TCP_PORT} already in use. Try: PRINTER_TCP_PORT=9101 node print-bridge.js\n`);
  } else {
    console.error('\n❌ TCP server error:', err.message);
  }
  process.exit(1);
});
