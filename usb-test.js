'use strict';
const usb = require('usb');
const dev = usb.findByIds(0x04b8, 0x0202);
if (!dev) { console.log('Device NOT found'); process.exit(1); }
console.log('Device found, descriptor:', JSON.stringify(dev.deviceDescriptor));
try {
  dev.open();
  const iface = dev.interface(0);
  console.log('Interface 0 endpoints:', JSON.stringify(iface.endpoints.map(function(e) {
    return { dir: e.direction, addr: e.address, type: e.transferType };
  })));
  dev.close();
  console.log('SUCCESS - can open device');
} catch(e) {
  console.log('Error:', e.message);
}
