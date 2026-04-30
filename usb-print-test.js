'use strict';
// Quick test: send ESC/POS directly to the Epson TM-T88IV via libusb
const usb = require('usb');

const device = usb.findByIds(0x04b8, 0x0202);
if (!device) { console.log('ERROR: Device not found'); process.exit(1); }

device.open();
const iface = device.interface(0);
try { iface.detachKernelDriver(); } catch (_) {}
iface.claim();

const outEp = iface.endpoints.find(ep => ep.direction === 'out' && ep.transferType === 2);
if (!outEp) { console.log('ERROR: No bulk-out endpoint'); process.exit(1); }

// ESC/POS: initialize, center, print "Hello USB", feed + cut
const data = Buffer.from([
  0x1b, 0x40,             // ESC @ — initialize
  0x1b, 0x61, 0x01,       // ESC a 1 — center
  0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x55, 0x53, 0x42, 0x21,  // "Hello USB!"
  0x0a, 0x0a, 0x0a,       // 3 line feeds
  0x1d, 0x56, 0x41, 0x03, // GS V A 3 — partial cut
]);

console.log('Sending', data.length, 'bytes to printer...');
outEp.transfer(data, (err) => {
  if (err) console.log('ERROR:', err.message);
  else console.log('SUCCESS! Data sent.');
  iface.release(true, () => device.close());
});
