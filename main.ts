// The World in One Day — Tuesday, 24 November 2026.
// A one-page newspaper front page drawn pixel by pixel with Node 22
// standard library only. No network, no fonts, no images: every letter
// comes from the small 5x7 bitmap alphabet below, and the PNG bytes
// are encoded by hand (zlib for the deflate step, CRC32 table built
// at runtime). The program writes exactly one file, entry.png, into
// $MAKEFUN_OUTPUT_DIR, and nothing anywhere else.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

// ---------------------------------------------------------------------
// 5x7 bitmap alphabet. Each letter is 7 rows; each row is a 5-bit
// number, bit 4 on the left. Only capitals, digits and the punctuation
// the page needs — the whole paper is set in capitals on purpose.
// ---------------------------------------------------------------------
const GLYPHS: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 17, 19, 21, 25, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 6, 8, 16, 31],
  "3": [30, 1, 1, 14, 1, 1, 30],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [6, 8, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 4, 8, 8, 8],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 2, 12],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 4, 8],
  ":": [0, 12, 12, 0, 12, 12, 0],
  ";": [0, 12, 12, 0, 12, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 2, 4, 0, 4],
  "-": [0, 0, 0, 14, 0, 0, 0],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "/": [1, 1, 2, 4, 8, 16, 16],
  "%": [17, 17, 2, 4, 8, 17, 17],
  "+": [0, 4, 4, 14, 4, 4, 0],
  "=": [0, 0, 31, 0, 31, 0, 0],
  '"': [10, 10, 10, 0, 0, 0, 0],
  "'": [4, 4, 8, 0, 0, 0, 0],
  "•": [0, 4, 14, 14, 14, 4, 0],
};

const BLANK = [0, 0, 0, 0, 0, 0, 0];

function cleanChar(ch: string): string {
  if (ch === "’" || ch === "‘") return "'";
  if (ch === "“" || ch === "”") return '"';
  if (ch === "–" || ch === "—") return "-";
  return ch.toUpperCase();
}

// ---------------------------------------------------------------------
// The sheet: one RGBA buffer plus the drawing verbs the page needs.
// ---------------------------------------------------------------------
class Sheet {
  readonly w: number;
  readonly h: number;
  readonly px: Buffer;

  constructor(w: number, h: number, paper: RGB) {
    this.w = w;
    this.h = h;
    this.px = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 4] = paper[0];
      this.px[i * 4 + 1] = paper[1];
      this.px[i * 4 + 2] = paper[2];
      this.px[i * 4 + 3] = 255;
    }
  }

  dot(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 4;
    this.px[o] = c[0];
    this.px[o + 1] = c[1];
    this.px[o + 2] = c[2];
    this.px[o + 3] = 255;
  }

  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.dot(xx, yy, c);
    }
  }

  frame(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.dot(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  disc(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -half; x <= half; x++) this.dot(cx + x, cy + y, c);
    }
  }

  ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
    for (let y = -r - t; y <= r + t; y++) {
      for (let x = -r - t; x <= r + t; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d >= r - t / 2 && d <= r + t / 2) this.dot(cx + x, cy + y, c);
      }
    }
  }

  // Filled triangle by scanline: walk the edges, fill between them.
  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGB): void {
    const minY = Math.min(ay, by, cy);
    const maxY = Math.max(ay, by, cy);
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      const edges: [number, number, number, number][] = [
        [ax, ay, bx, by],
        [bx, by, cx, cy],
        [cx, cy, ax, ay],
      ];
      for (const [x1, y1, x2, y2] of edges) {
        if (y1 === y2) continue;
        const lo = Math.min(y1, y2);
        const hi = Math.max(y1, y2);
        if (y < lo || y > hi) continue;
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
      if (xs.length < 2) continue;
      xs.sort((a, b) => a - b);
      for (let x = Math.floor(xs[0]); x <= Math.ceil(xs[xs.length - 1]); x++) {
        this.dot(x, y, c);
      }
    }
  }

  // Filled polygon (even-odd scanline) for hulls, jets and rooftops.
  poly(points: [number, number][], c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if (y1 === y2) continue;
        const lo = Math.min(y1, y2);
        const hi = Math.max(y1, y2);
        if (y < lo || y >= hi) continue;
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.floor(xs[i]); x <= Math.ceil(xs[i + 1]); x++) {
          this.dot(x, y, c);
        }
      }
    }
  }

  // -- text -------------------------------------------------------------
  glyph(ch: string): number[] {
    return GLYPHS[cleanChar(ch)] ?? BLANK;
  }

  charW(scale: number): number {
    return 6 * scale;
  }

  textW(text: string, scale: number): number {
    if (text.length === 0) return 0;
    return text.length * this.charW(scale) - scale;
  }

  drawChar(x: number, y: number, ch: string, scale: number, c: RGB): void {
    const rows = this.glyph(ch);
    for (let r = 0; r < 7; r++) {
      const bits = rows[r];
      for (let col = 0; col < 5; col++) {
        if ((bits >> (4 - col)) & 1) {
          this.rect(x + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }

  // align: "l" | "c" | "r". bold draws each glyph twice, 1 unit apart.
  text(
    x: number,
    y: number,
    text: string,
    scale: number,
    c: RGB,
    align: "l" | "c" | "r" = "l",
    bold = false,
  ): void {
    const w = this.textW(text, scale);
    let sx = x;
    if (align === "c") sx = x - Math.floor(w / 2);
    if (align === "r") sx = x - w;
    const step = bold ? Math.max(1, Math.floor(scale / 2)) : 0;
    for (let i = 0; i < text.length; i++) {
      const cx = sx + i * this.charW(scale);
      this.drawChar(cx, y, text[i], scale, c);
      if (bold) this.drawChar(cx + step, y, text[i], scale, c);
    }
  }

  // Greedy word wrap. Returns lines that each fit maxW pixels.
  wrap(text: string, maxW: number, scale: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const word of words) {
      const trial = cur === "" ? word : cur + " " + word;
      if (this.textW(trial, scale) <= maxW) {
        cur = trial;
        continue;
      }
      if (cur !== "") lines.push(cur);
      // A single word too wide for the column: break it by letters.
      if (this.textW(word, scale) > maxW) {
        let chunk = "";
        for (const ch of word) {
          if (this.textW(chunk + ch, scale) <= maxW) chunk += ch;
          else {
            lines.push(chunk);
            chunk = ch;
          }
        }
        cur = chunk;
      } else {
        cur = word;
      }
    }
    if (cur !== "") lines.push(cur);
    return lines;
  }

  // A block of wrapped lines. Returns the y just below the last line.
  para(x: number, y: number, text: string, maxW: number, scale: number, c: RGB, leading = 4): number {
    const lines = this.wrap(text, maxW, scale);
    const lh = 7 * scale + leading;
    lines.forEach((ln, i) => this.text(x, y + i * lh, ln, scale, c));
    return y + lines.length * lh;
  }
}

// ---------------------------------------------------------------------
// PNG encoder: 8-bit RGBA, filter 0 on every scanline, zlib level 9.
// CRC32 table is generated at runtime from the polynomial.
// ---------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  return Buffer.concat([u32be(data.length), body, u32be(crc32(body))]);
}

function encodePng(sheet: Sheet): Buffer {
  const raw = Buffer.alloc(sheet.h * (1 + sheet.w * 4));
  for (let y = 0; y < sheet.h; y++) {
    const rowStart = y * (1 + sheet.w * 4);
    raw[rowStart] = 0; // filter: None
    sheet.px.copy(raw, rowStart + 1, y * sheet.w * 4, (y + 1) * sheet.w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(sheet.w, 0);
  ihdr.writeUInt32BE(sheet.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------
// Palette and page furniture.
// ---------------------------------------------------------------------
const PAPER: RGB = [246, 241, 229];
const INK: RGB = [27, 24, 19];
const RED: RGB = [163, 31, 22];
const NAVY: RGB = [29, 63, 110];
const SEA: RGB = [24, 74, 110];
const SKY: RGB = [214, 226, 232];
const SAND: RGB = [233, 222, 190];
const LEAF: RGB = [46, 102, 60];
const FLAME: RGB = [214, 110, 24];
const SUN: RGB = [232, 180, 32];
const GREY: RGB = [120, 116, 108];
const WHITE: RGB = [255, 255, 255];

const MARGIN = 28;
const RIGHT = W - MARGIN;

// A red label tag with white text. Returns the y below the tag.
function tag(s: Sheet, x: number, y: number, label: string): number {
  const scale = 2;
  const pad = 10;
  const w = s.textW(label, scale) + pad * 2;
  s.rect(x, y, w, 26, RED);
  s.text(x + pad, y + 6, label, scale, WHITE);
  return y + 26;
}

// A plain red kicker line with a small square bullet. Returns y below.
function kicker(s: Sheet, x: number, y: number, label: string): number {
  s.rect(x, y + 2, 10, 10, RED);
  s.text(x + 18, y, label, 2, RED, "l", true);
  return y + 20;
}

// A bold wrapped headline. Returns the y below the last line.
function headline(s: Sheet, x: number, y: number, maxW: number, text: string, scale: number): number {
  const lines = s.wrap(text, maxW, scale);
  const lh = 7 * scale + 6;
  lines.forEach((ln, i) => s.text(x, y + i * lh, ln, scale, INK, "l", true));
  return y + lines.length * lh;
}

// Wrapped body paragraphs with a gap between them. Returns y below.
function bodyText(s: Sheet, x: number, y: number, maxW: number, paras: string[]): number {
  let yy = y;
  for (const p of paras) {
    yy = s.para(x, yy, p, maxW, 2, INK, 4);
    yy += 6;
  }
  return yy - 6;
}

// A thin horizontal rule across the page.
function rule(s: Sheet, y: number, t: number): void {
  s.rect(MARGIN, y, RIGHT - MARGIN, t, INK);
}

// ---------------------------------------------------------------------
// The lead illustration: a radar scope over Ulleung Island — sky, sun,
// sea, two green islands, a jet silhouette, radar rings and a warning
// triangle, with a caption strip along the bottom.
// ---------------------------------------------------------------------
function drawAlertScene(s: Sheet, x: number, y: number, w: number, h: number): void {
  s.frame(x, y, w, h, 3, INK);
  const ix = x + 3;
  const iy = y + 3;
  const iw = w - 6;
  const ih = h - 6;
  // Sky, then sea.
  s.rect(ix, iy, iw, 118, SKY);
  s.rect(ix, iy + 118, iw, 62, SAND);
  s.rect(ix, iy + 180, iw, ih - 180, SEA);
  // Sun and radar rings.
  s.disc(ix + 52, iy + 46, 24, SUN);
  s.ring(ix + iw - 52, iy + 52, 40, 3, INK);
  s.ring(ix + iw - 52, iy + 52, 27, 3, INK);
  s.ring(ix + iw - 52, iy + 52, 14, 3, INK);
  s.disc(ix + iw - 52, iy + 52, 5, RED);
  // Jet silhouette crossing the sky.
  s.poly(
    [
      [ix + 78, iy + 96],
      [ix + 210, iy + 104],
      [ix + 228, iy + 112],
      [ix + 210, iy + 118],
      [ix + 96, iy + 116],
      [ix + 118, iy + 108],
    ],
    INK,
  );
  s.tri(ix + 150, iy + 104, ix + 168, iy + 82, ix + 176, iy + 106, INK);
  // Islands rising out of the sea.
  s.tri(ix + 8, iy + 236, ix + 78, iy + 158, ix + 148, iy + 236, LEAF);
  s.tri(ix + 118, iy + 236, ix + 178, iy + 178, ix + 238, iy + 236, LEAF);
  // Warning triangle floating on the sea, clear of the islands.
  s.tri(ix + 50, iy + 240, ix + 82, iy + 274, ix + 18, iy + 274, INK);
  s.tri(ix + 50, iy + 247, ix + 75, iy + 269, ix + 25, iy + 269, SUN);
  s.text(ix + 50, iy + 250, "!", 3, INK, "c", true);
  // Caption strip.
  s.rect(ix, iy + ih - 34, iw, 34, PAPER);
  s.rect(ix, iy + ih - 34, iw, 3, RED);
  s.text(ix + iw / 2, iy + ih - 26, "ULLEUNG ISLAND ALERT", 2, RED, "c", true);
}

// ---------------------------------------------------------------------
// The front page.
// ---------------------------------------------------------------------
function buildPage(): Sheet {
  const s = new Sheet(W, H, PAPER);
  s.frame(10, 10, W - 20, H - 20, 4, INK);
  s.frame(20, 20, W - 40, H - 40, 1, INK);

  // Masthead.
  s.text(W / 2, 36, "THE WORLD IN ONE DAY", 6, INK, "c", true);
  s.rect(MARGIN, 92, RIGHT - MARGIN, 3, INK);
  s.rect(MARGIN, 98, RIGHT - MARGIN, 1, INK);

  // Date line.
  s.text(MARGIN, 110, "WORLD NEWS", 2, INK, "l", true);
  s.text(W / 2, 108, "TUESDAY, 24 NOVEMBER 2026", 3, INK, "c", true);
  s.text(RIGHT, 110, "ONE DAY, ONE PAGE", 2, INK, "r", true);
  rule(s, 140, 3);

  // ---- Lead story: Korea --------------------------------------------
  const leadX = MARGIN;
  const leadW = 640;
  const sceneX = 688;
  const sceneW = RIGHT - sceneX;
  tag(s, leadX, 152, "KOREA • AIRSPACE ALERT");
  let y = headline(
    s,
    leadX,
    190,
    leadW,
    "SEOUL ORDERS ISLAND TO SHELTER AS MYSTERY JET ENTERS ITS SKIES",
    4,
  );
  y = bodyText(s, leadX, y + 10, leadW, [
    "SEOUL — RESIDENTS OF ULLEUNG ISLAND WERE TOLD TO TAKE SHELTER ON TUESDAY MORNING AFTER AN UNIDENTIFIED AIRCRAFT ENTERED SOUTH KOREAN AIRSPACE. THE ALERT, ISSUED AT 07:52, WAS LIFTED MINUTES LATER. OFFICIALS FIRST SAID THE JET WAS RUSSIAN, THEN SAID IT MAY HAVE BEEN NORTH KOREAN.",
  ]);
  s.text(leadX, y + 8, "CONTEXT:", 2, RED, "l", true);
  s.para(
    leadX + 104,
    y + 8,
    "SECOND AIRSPACE SCARE IN A WEEK, AFTER RUSSIAN PLANES ENTERED KOREA'S AIR DEFENCE ZONE ON 17 NOVEMBER.",
    leadW - 104,
    2,
    INK,
    4,
  );
  drawAlertScene(s, sceneX, 152, sceneW, 318);
  rule(s, 482, 2);

  // ---- Middle row: Banten and Ukraine -------------------------------
  const colW = 472;
  const col2X = 524;
  s.rect(510, 494, 2, 222, GREY);

  kicker(s, MARGIN, 494, "INDONESIA • FACTORY FIRE");
  y = headline(s, MARGIN, 520, colW, "24 DEAD AS FACTORY FIRE SEARCH GOES ON", 3);
  bodyText(s, MARGIN, y + 8, colW, [
    "INDONESIA CONFIRMED 24 DEATHS IN A CANDY FACTORY FIRE, WITH ABOUT 30 WORKERS STILL MISSING.",
    "THE BLAZE BROKE OUT ON SATURDAY AT THE PT FONUSA AGUNG MULIA PLANT IN CIKANDE. AN AIR-CONDITIONER SHORT CIRCUIT IS THE SUSPECTED CAUSE.",
  ]);

  kicker(s, col2X, 494, "UKRAINE • KYIV UNDER FIRE");
  y = headline(s, col2X, 520, colW, "MISSILES HIT THREE KYIV BRIDGES OVERNIGHT", 3);
  bodyText(s, col2X, y + 8, colW, [
    "KYIV — RUSSIAN MISSILES AND DRONES STRUCK THE CAPITAL OVERNIGHT, HITTING THREE BRIDGES OVER THE DNIPRO RIVER AND KILLING THREE PEOPLE.",
    "UKRAINE SAID ALMOST 100 MISSILES AND ABOUT 400 DRONES WERE LAUNCHED IN ONE OF THE LARGEST ATTACKS OF THE WAR.",
  ]);
  rule(s, 728, 2);

  // ---- Bottom row: Baltic and Portugal ------------------------------
  s.rect(510, 740, 2, 166, GREY);

  kicker(s, MARGIN, 740, "BALTIC SEA • SHIP ON FIRE");
  y = headline(s, MARGIN, 766, colW, "CARGO SHIP BURNS AFTER DRONE ATTACK", 3);
  bodyText(s, MARGIN, y + 8, colW, [
    "THE RUSSIAN CARGO SHIP SPARTA II CAUGHT FIRE IN THE GULF OF FINLAND AFTER A DRONE STRIKE. ITS 16 CREW WERE EVACUATED AND IT WAS TOWED TO ST PETERSBURG.",
  ]);

  kicker(s, col2X, 740, "PORTUGAL • COST OF LIVING");
  y = headline(s, col2X, 766, colW, "THOUSANDS MARCH IN LISBON OVER PRICES", 3);
  bodyText(s, col2X, y + 8, colW, [
    "THOUSANDS MARCHED THROUGH LISBON ON SATURDAY OVER LIVING COSTS, WAGES AND HOUSING. UNIONS PLANNED ANOTHER PROTEST OUTSIDE PARLIAMENT ON TUESDAY.",
  ]);
  rule(s, 918, 2);

  // ---- Ticker --------------------------------------------------------
  s.rect(MARGIN, 930, RIGHT - MARGIN, 64, NAVY);
  s.text(
    W / 2,
    940,
    "ALSO TODAY: NATO HOLDS EMERGENCY MEETING • COP31 HANDS OVER TO COP32",
    2,
    WHITE,
    "c",
  );
  s.text(
    W / 2,
    962,
    "WORLD CHESS TITLE OPENS IN GENEVA • VERSTAPPEN WINS LAS VEGAS GP",
    2,
    WHITE,
    "c",
  );

  return s;
}

function main(): void {
  const out = process.env.MAKEFUN_OUTPUT_DIR;
  if (!out) throw new Error("MAKEFUN_OUTPUT_DIR is not set");
  mkdirSync(out, { recursive: true });
  const png = encodePng(buildPage());
  writeFileSync(join(out, "entry.png"), png);
}

main();
