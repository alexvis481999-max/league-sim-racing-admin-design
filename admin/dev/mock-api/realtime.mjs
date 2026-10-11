// Dev-only WebSocket for /realtime (shared/realtime-client.ts protocol): subscribe → resync, ping → pong,
// broadcast(domain) → realtime.invalidate on admin:changes so screens re-read their HTTP projections.
import { createHash } from 'node:crypto';

const clients = new Set();

function frame(text) {
  const data = Buffer.from(text);
  const header = data.length < 126 ? Buffer.from([0x81, data.length])
    : data.length < 65536 ? Buffer.from([0x81, 126, data.length >> 8, data.length & 255])
    : Buffer.concat([Buffer.from([0x81, 127, 0, 0, 0, 0]), Buffer.from([(data.length >>> 24) & 255, (data.length >>> 16) & 255, (data.length >>> 8) & 255, data.length & 255])]);
  return Buffer.concat([header, data]);
}
function parse(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const opcode = buffer[offset] & 15;
    let length = buffer[offset + 1] & 127, pos = offset + 2;
    if (length === 126) { length = buffer.readUInt16BE(pos); pos += 2; } else if (length === 127) { length = Number(buffer.readBigUInt64BE(pos)); pos += 8; }
    const masked = buffer[offset + 1] & 128;
    const mask = masked ? buffer.subarray(pos, pos + 4) : null;
    if (masked) pos += 4;
    if (pos + length > buffer.length) break;
    const payload = Buffer.from(buffer.subarray(pos, pos + length));
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    messages.push({ opcode, text: payload.toString() });
    offset = pos + length;
  }
  return { messages, rest: buffer.subarray(offset) };
}

export function attachRealtime(server) {
  server.on('upgrade', (req, socket) => {
    if (!req.url?.startsWith('/realtime')) { socket.destroy(); return; }
    const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const client = { socket, version: 0, channels: new Set() };
    const send = (message) => { client.version += 1; socket.write(frame(JSON.stringify({ id: `m${client.version}`, version: client.version, occurredAt: new Date().toISOString(), channel: '', payload: {}, ...message }))); };
    client.send = send;
    clients.add(client);
    let pending = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      const { messages, rest } = parse(Buffer.concat([pending, chunk]));
      pending = rest;
      for (const m of messages) {
        if (m.opcode === 8) { socket.end(); return; }
        if (m.opcode !== 1) continue;
        let data; try { data = JSON.parse(m.text); } catch { continue; }
        if (data.type === 'realtime.ping') send({ type: 'realtime.pong' });
        if (data.type === 'realtime.subscribe') { client.channels = new Set(data.channels ?? []); send({ type: 'realtime.resync', subscription: data.subscription, payload: { reason: 'subscribed' } }); }
      }
    });
    socket.on('close', () => clients.delete(client));
    socket.on('error', () => clients.delete(client));
  });
}

export function broadcast(domain) {
  for (const client of clients) if (client.channels.has('admin:changes')) client.send({ type: 'realtime.invalidate', channel: 'admin:changes', payload: { domain } });
}
