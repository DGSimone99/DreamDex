/**
 * Misura dove stanno i piedi di ogni sprite statico di Showdown (gen5, 96×96): la riga più in basso con un pixel non
 * trasparente. Gli sprite non hanno i piedi tutti alla stessa altezza (Joltik a 63, Kingambit a 90), quindi sulla pedana
 * i più piccoli sembravano fluttuare. Scrive src/ui/spriteFeet.ts, che Sprite usa per appoggiarli tutti allo stesso punto.
 * Si rilancia solo quando arrivano Pokémon nuovi: npx tsx scripts/sprite-feet.ts
 */
import { writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dex, toID } from '../src/engine/dex';

/** La riga più in basso con un pixel visibile (alfa > 40) di un PNG non interlacciato. */
function lowestRow(buf: Buffer): number {
  let p = 8, w = 0, h = 0, depth = 8, ct = 6, interlace = 0;
  let trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ct = d[9]; interlace = d[12]; }
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (interlace) throw new Error('PNG interlacciato');
  const ch = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[ct];
  const bpp = Math.max(1, (ch * depth) >> 3), stride = Math.ceil((w * ch * depth) / 8);
  const raw = inflateSync(Buffer.concat(idat)), out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[o + x - bpp] : 0, b = y ? out[o - stride + x] : 0, c = y && x >= bpp ? out[o - stride + x - bpp] : 0;
      let v = raw[y * (stride + 1) + 1 + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[o + x] = v & 255;
    }
  }
  const alpha = (x: number, y: number): number => {
    if (ct === 6) return out[y * stride + x * 4 + 3];
    if (ct === 4) return out[y * stride + x * 2 + 1];
    if (ct === 3) {
      const bit = x * depth, idx = (out[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      return trns && idx < trns.length ? trns[idx] : 255;
    }
    return 255;
  };
  for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (alpha(x, y) > 40) return y;
  return -1;
}

// Gli stessi id di Sprite.tsx (spriteId): "landorus-therian", "charizard-megay"
const ids = [...new Set(dex.species.all().filter(s => s.exists && s.num > 0)
  .map(s => (s.forme ? `${toID(s.baseSpecies)}-${toID(s.forme)}` : toID(s.baseSpecies))))].sort();

const feet: Record<string, number> = {};
let missing = 0, next = 0;
async function worker() {
  while (next < ids.length) {
    const id = ids[next++];
    const res = await fetch(`https://play.pokemonshowdown.com/sprites/gen5/${id}.png`);
    if (!res.ok) { missing++; continue; }
    const row = lowestRow(Buffer.from(await res.arrayBuffer()));
    if (row >= 0) feet[id] = row;
  }
}
await Promise.all(Array.from({ length: 12 }, worker));

// Nel file solo chi non ha i piedi alla riga di riferimento (FEET_ROW): gli altri stanno già bene
const FEET_ROW = 86;
const entries = Object.keys(feet).sort().filter(id => feet[id] !== FEET_ROW).map(id => `${JSON.stringify(id)}:${feet[id]}`);
writeFileSync('src/ui/spriteFeet.ts', `// Generato da scripts/sprite-feet.ts: non modificare a mano.
/** La riga dei piedi a cui la pedana è tarata, nello sprite statico di 96 px. */
export const FEET_ROW = ${FEET_ROW};
/** Riga più in basso dello sprite statico (gen5, 96 px) di chi non ha i piedi a FEET_ROW. */
export const SPRITE_FEET: Record<string, number> = {${entries.join(',')}};
`);
console.log(`${Object.keys(feet).length} sprite misurati, ${entries.length} fuori riga, ${missing} senza sprite`);
