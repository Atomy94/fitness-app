// Erzeugt die App-Symbole (PNG) ohne fremde Bibliotheken: dunkler Grund, drei Ringe
// in den Farben der Bereiche. Aufruf: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTabelle = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTabelle[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(typ, daten) {
  const kopf = Buffer.alloc(4); kopf.writeUInt32BE(daten.length);
  const inhalt = Buffer.concat([Buffer.from(typ), daten]);
  const summe = Buffer.alloc(4); summe.writeUInt32BE(crc(inhalt));
  return Buffer.concat([kopf, inhalt, summe]);
}

function png(n) {
  const roh = Buffer.alloc(n * (n * 3 + 1));
  const grund = [16, 18, 20];
  const ringe = [[0.36, [63, 202, 125], 0.82], [0.25, [91, 157, 255], 0.65], [0.14, [255, 154, 98], 0.5]];
  const dicke = 0.075;
  const AA = 3;
  for (let y = 0; y < n; y++) {
    roh[y * (n * 3 + 1)] = 0;
    for (let x = 0; x < n; x++) {
      const farbe = [0, 0, 0];
      for (let sy = 0; sy < AA; sy++) for (let sx = 0; sx < AA; sx++) {
        const dx = (x + (sx + 0.5) / AA) / n - 0.5;
        const dy = (y + (sy + 0.5) / AA) / n - 0.5;
        const r = Math.hypot(dx, dy);
        const winkel = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1; // 0 = oben, im Uhrzeigersinn
        let f = grund;
        for (const [radius, c, anteil] of ringe) {
          if (Math.abs(r - radius) <= dicke / 2) f = winkel <= anteil ? c : c.map((v, i) => Math.round(v * 0.25 + grund[i] * 0.75));
        }
        for (let i = 0; i < 3; i++) farbe[i] += f[i];
      }
      const p = y * (n * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) roh[p + i] = Math.round(farbe[i] / (AA * AA));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 Bit, RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(roh, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('icons', { recursive: true });
for (const n of [180, 192, 512]) {
  writeFileSync(`icons/icon-${n}.png`, png(n));
  console.log(`icons/icon-${n}.png`);
}
