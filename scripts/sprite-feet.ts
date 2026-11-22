/**
 * Misura dove stanno i piedi di ogni sprite statico di Showdown (gen5, 96×96): la riga più in basso con un pixel non
 * trasparente, e il centro orizzontale del corpo; della GIF animata (se c'è) le misure e il primo fotogramma, per
 * appoggiarla proprio dove stava lo statico. Gli sprite non hanno i piedi tutti alla stessa altezza (Joltik a 63, Kingambit a 90), quindi sulla pedana
 * i più piccoli sembravano fluttuare, e molti sono spostati a destra o a sinistra. Scrive src/ui/spriteFeet.ts, che Sprite usa per appoggiarli tutti allo stesso punto.
 * Si rilancia solo quando arrivano Pokémon nuovi: npx tsx scripts/sprite-feet.ts
 */
import { writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dex, toID } from '../src/engine/dex';

/**
 * I piedi di un PNG non interlacciato: la riga più in basso con un pixel visibile (alfa > 40) e il centro orizzontale di
 * tutti i pixel visibili (il "peso" del corpo: i soli piedi sbagliano con chi tocca terra con una zampa o con la coda,
 * come Metagross e Regieleki).
 */
function feetOf(buf: Buffer): { row: number; x: number } | null {
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
  let row = -1;
  for (let y = h - 1; y >= 0 && row < 0; y--) for (let x = 0; x < w; x++) if (alpha(x, y) > 40) { row = y; break; }
  if (row < 0) return null;
  let sum = 0, n = 0;
  for (let y = 0; y <= row; y++) for (let x = 0; x < w; x++) if (alpha(x, y) > 40) { sum += x + 0.5; n++; }
  return { row, x: Math.round((sum / n) * 10) / 10 };
}

/**
 * Il primo fotogramma di una GIF (quello che si vede quando prende il posto dello statico): larghezza e altezza della GIF,
 * centro orizzontale del corpo nel fotogramma e quante righe vuote restano sotto i piedi. null se non si legge.
 */
function gifFirstFrame(buf: Buffer): { w: number; h: number; x: number; gap: number } | null {
  if (buf.toString('ascii', 0, 3) !== 'GIF') return null;
  const w = buf.readUInt16LE(6), h = buf.readUInt16LE(8), flags = buf[10];
  let p = 13 + (flags & 0x80 ? 3 * (1 << ((flags & 7) + 1)) : 0);
  let transparent = -1;
  while (p < buf.length) {
    const block = buf[p];
    if (block === 0x21) {
      // Estensione: dal Graphic Control prende il colore trasparente
      if (buf[p + 1] === 0xf9 && buf[p + 3] & 1) transparent = buf[p + 6];
      p += 2;
      while (buf[p]) p += buf[p] + 1;
      p++;
    } else if (block === 0x2c) {
      const fx = buf.readUInt16LE(p + 1), fy = buf.readUInt16LE(p + 3), fw = buf.readUInt16LE(p + 5), fh = buf.readUInt16LE(p + 7), ff = buf[p + 9];
      if (ff & 0x40) return null; // interlacciata: non capita negli sprite di Showdown
      p += 10 + (ff & 0x80 ? 3 * (1 << ((ff & 7) + 1)) : 0);
      const minCode = buf[p++];
      const parts: Buffer[] = [];
      while (buf[p]) { parts.push(buf.subarray(p + 1, p + 1 + buf[p])); p += buf[p] + 1; }
      const data = Buffer.concat(parts);
      // LZW
      const clear = 1 << minCode, end = clear + 1;
      const out = new Uint8Array(fw * fh);
      let size = minCode + 1, dict: number[][] = [], prev: number[] | null = null, o = 0, bit = 0;
      const reset = () => { dict = Array.from({ length: clear }, (_, i) => [i]); dict.push([], []); size = minCode + 1; prev = null; };
      reset();
      while (o < out.length && bit + size <= data.length * 8) {
        let code = 0;
        for (let i = 0; i < size; i++, bit++) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
        if (code === clear) { reset(); continue; }
        if (code === end) break;
        const entry: number[] = code < dict.length ? dict[code] : prev ? [...prev, prev[0]] : [];
        for (const v of entry) if (o < out.length) out[o++] = v;
        if (prev) dict.push([...prev, entry[0]]);
        prev = entry;
        if (dict.length === 1 << size && size < 12) size++;
      }
      let sum = 0, n = 0, low = -1;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (out[y * fw + x] !== transparent) { sum += fx + x + 0.5; n++; low = fy + y; }
      if (!n) return null;
      return { w, h, x: Math.round((sum / n) * 10) / 10, gap: h - 1 - low };
    } else return null;
  }
  return null;
}

// Gli stessi id di Sprite.tsx (spriteId): "landorus-therian", "charizard-megay"
const ids = [...new Set(dex.species.all().filter(s => s.exists && s.num > 0)
  .map(s => (s.forme ? `${toID(s.baseSpecies)}-${toID(s.forme)}` : toID(s.baseSpecies))))].sort();

const feet: Record<string, { row: number; x: number }> = {};
/** La GIF animata (gen5ani): altezza, di quanto spostarla di lato e quanto sotto i piedi, o niente se Showdown non ce l'ha */
const ani: Record<string, { h: number; dx: number; gap: number }> = {};
async function gifOf(id: string): Promise<{ h: number; dx: number; gap: number } | undefined> {
  const res = await fetch(`https://play.pokemonshowdown.com/sprites/gen5ani/${id}.gif`);
  if (!res.ok) return undefined;
  const g = gifFirstFrame(Buffer.from(await res.arrayBuffer()));
  // Centrata sul suo riquadro (largo g.w): quanto spostarla perché il corpo del primo fotogramma stia al centro
  return g ? { h: g.h, dx: Math.round((g.w / 2 - g.x) * 10) / 10, gap: g.gap } : undefined;
}
let missing = 0, next = 0;
async function worker() {
  while (next < ids.length) {
    const id = ids[next++];
    const res = await fetch(`https://play.pokemonshowdown.com/sprites/gen5/${id}.png`);
    if (!res.ok) { missing++; continue; }
    const f = feetOf(Buffer.from(await res.arrayBuffer()));
    if (f) { feet[id] = f; const a = await gifOf(id); if (a) ani[id] = a; }
  }
}
await Promise.all(Array.from({ length: 12 }, worker));

// Il punto di riferimento: piedi alla riga FEET_ROW, corpo al centro FEET_X
const FEET_ROW = 86, FEET_X = 48;
const entries = Object.keys(feet).sort().map(id => `${JSON.stringify(id)}:[${feet[id].row},${feet[id].x}${ani[id] ? `,${ani[id].h},${ani[id].dx},${ani[id].gap}` : ''}]`);
writeFileSync('src/ui/spriteFeet.ts', `// Generato da scripts/sprite-feet.ts: non modificare a mano.
/** Il punto dei piedi a cui la pedana è tarata, nello sprite statico di 96 px: riga e colonna (il centro). */
export const FEET_ROW = ${FEET_ROW};
export const FEET_X = ${FEET_X};
/**
 * Per ogni sprite statico (gen5, 96 px): [riga più in basso, centro orizzontale del corpo] e, se Showdown ha la GIF
 * animata (gen5ani), [altezza della GIF, di quanto spostarla di lato perché il corpo del suo primo fotogramma stia al
 * centro, righe vuote sotto i piedi in quel fotogramma] (px dello sprite di 96).
 */
export const SPRITE_FEET: Record<string, [number, number] | [number, number, number, number, number]> = {${entries.join(',')}};
`);
console.log(`${Object.keys(feet).length} sprite misurati, ${Object.keys(feet).filter(id => !ani[id]).length} senza GIF, ${missing} senza sprite`);
