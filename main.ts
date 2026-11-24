// The World in One Day — Tuesday, 24 November 2026.
// A deterministic newspaper front page drawn pixel by pixel with the Node 22
// standard library only. No network, no randomness, no wall clock: two runs
// write byte-identical PNGs.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//   -> out/entry.png (1024 x 1024, well under the 1 MiB cap)

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

// ---- palette -------------------------------------------------------------
const PAPER: RGB = [248, 244, 232];
const INK: RGB = [22, 22, 22];
const RED: RGB = [176, 32, 26];
const TEAL: RGB = [16, 66, 82];
const TEAL_DARK: RGB = [10, 40, 56];
const SKY: RGB = [214, 232, 238];
const SKY_DUSK: RGB = [232, 214, 180];
const BLUE: RGB = [38, 84, 160];
const SEA: RGB = [18, 52, 96];
const SEA_LIGHT: RGB = [44, 96, 148];
const GREY: RGB = [122, 122, 116];
const GREY_LIGHT: RGB = [178, 178, 170];
const GREY_DARK: RGB = [74, 74, 70];
const DARK: RGB = [30, 34, 40];
const ORANGE: RGB = [232, 120, 24];
const ORANGE_DARK: RGB = [198, 74, 32];
const YELLOW: RGB = [240, 196, 48];
const GREEN: RGB = [52, 120, 64];
const GREEN_DARK: RGB = [34, 84, 44];
const WHITE: RGB = [255, 255, 255];
const BROWN: RGB = [122, 84, 52];

// ---- canvas --------------------------------------------------------------
const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function set(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) set(xx, yy, c);
  }
}

function rect(x: number, y: number, w: number, h: number, c: RGB, t: number): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function hline(x: number, y: number, w: number, c: RGB, t: number): void {
  fillRect(x, y, w, t, c);
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) set(x, y, c);
    }
  }
}

function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let y = cy - r - t; y <= cy + r + t; y++) {
    for (let x = cx - r - t; x <= cx + r + t; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= (r + t) * (r + t) && d2 >= (r - t) * (r - t)) set(x, y, c);
    }
  }
}

function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    set(x, y, c);
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

function thickLine(x0: number, y0: number, x1: number, y1: number, r: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    disc(x, y, r, c);
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

function fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: Array<[number, number, number, number]> = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length >= 2) {
      const lo = Math.ceil(Math.min(xs[0], xs[1]));
      const hi = Math.floor(Math.max(xs[0], xs[1]));
      for (let x = lo; x <= hi; x++) set(x, y, c);
    }
  }
}

// ---- 5x7 bitmap font (rows are 5-bit values, MSB = leftmost pixel) -------
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "\u201c": [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  "\u201d": [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  "\u2018": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "\u2019": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "\u2022": [0, 0x0e, 0x1f, 0x1f, 0x1f, 0x0e, 0],
};

function textWidth(s: string, scale: number, gap = 1): number {
  if (s.length === 0) return 0;
  return s.length * (6 * scale + gap) - gap;
}

function drawText(x: number, y: number, s: string, scale: number, c: RGB, gap = 1): void {
  const up = s.toUpperCase();
  let cx = x;
  for (const ch of up) {
    const g = FONT[ch];
    if (g) {
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if ((g[row] >> (4 - col)) & 1) {
            fillRect(cx + col * scale, y + row * scale, scale, scale, c);
          }
        }
      }
    }
    cx += 6 * scale + gap;
  }
}

function centerText(x0: number, x1: number, y: number, s: string, scale: number, c: RGB, gap = 1): void {
  const w = textWidth(s, scale, gap);
  drawText(x0 + Math.floor((x1 - x0 - w) / 2), y, s, scale, c, gap);
}

function wrapText(s: string, maxW: number, scale: number, gap = 1): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale, gap) <= maxW) {
      cur = trial;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function paragraph(x: number, y: number, s: string, scale: number, maxW: number, c: RGB, lineH: number): number {
  const lines = wrapText(s, maxW, scale);
  let yy = y;
  for (const ln of lines) {
    drawText(x, yy, ln, scale, c);
    yy += lineH;
  }
  return yy;
}

// ---- PNG encoder (deterministic: fixed filter 0, zlib level 9) -------------
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- illustration panels --------------------------------------------------

// Lead: an island in a morning sea under a jet and a warning triangle.
function leadPanel(x: number, y: number, w: number, h: number): void {
  // dawn sky bands, pale at the top
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const c: RGB = [
      Math.round(232 + (214 - 232) * t),
      Math.round(214 + (232 - 214) * t),
      Math.round(180 + (238 - 180) * t),
    ];
    fillRect(x, y + Math.floor((i * h) / bands), w, Math.ceil(h / bands) + 1, c);
  }
  // pale sun
  disc(x + 56, y + 46, 24, [240, 226, 160]);
  // radar rings top right
  ring(x + w - 58, y + 58, 34, 3, INK);
  ring(x + w - 58, y + 58, 20, 3, INK);
  disc(x + w - 58, y + 58, 5, RED);
  // the jet, dark silhouette crossing the sky
  fillRect(x + 118, y + 96, 120, 12, DARK);
  fillTriangle(x + 238, y + 96, x + 238, y + 108, x + 268, y + 102, DARK);
  fillTriangle(x + 150, y + 108, x + 190, y + 108, x + 168, y + 140, DARK);
  fillTriangle(x + 196, y + 96, x + 214, y + 96, x + 206, y + 76, DARK);
  // the sea
  fillRect(x, y + 190, w, h - 190, SEA);
  hline(x, y + 216, w, SEA_LIGHT, 2);
  hline(x, y + 244, w, SEA_LIGHT, 2);
  // the island: green hill rising from the sea
  fillTriangle(x + 60, y + 236, x + 200, y + 236, x + 130, y + 150, GREEN_DARK);
  fillTriangle(x + 150, y + 236, x + 300, y + 236, x + 228, y + 168, GREEN);
  disc(x + 130, y + 158, 10, GREEN_DARK);
  // warning triangle over the island
  fillTriangle(x + 268, y + 218, x + 332, y + 218, x + 300, y + 162, YELLOW);
  fillTriangle(x + 276, y + 212, x + 324, y + 212, x + 300, y + 170, INK);
  fillTriangle(x + 282, y + 208, x + 318, y + 208, x + 300, y + 174, YELLOW);
  drawText(x + 294, y + 180, "!", 2, INK);
  // the alert strip
  fillRect(x, y + h - 34, w, 34, WHITE);
  centerText(x, x + w, y + h - 26, "ULLEUNG ISLAND ALERT", 2, RED);
  rect(x, y, w, h, INK, 3);
}

// Indonesia: a factory at night, flames and smoke above the roof.
function factoryPanel(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, 96, GREY_DARK);
  fillRect(x, y + 96, w, h - 96, DARK);
  centerText(x, x + w, y + 12, "CIKANDE, BANTEN", 2, WHITE);
  // flames above the factory roof
  fillTriangle(x + 96, y + 128, x + 136, y + 128, x + 116, y + 78, ORANGE);
  fillTriangle(x + 128, y + 128, x + 168, y + 128, x + 148, y + 88, ORANGE);
  fillTriangle(x + 160, y + 128, x + 196, y + 128, x + 178, y + 96, ORANGE);
  fillTriangle(x + 108, y + 128, x + 128, y + 128, x + 118, y + 104, YELLOW);
  fillTriangle(x + 140, y + 128, x + 160, y + 128, x + 150, y + 108, YELLOW);
  // smoke
  disc(x + 116, y + 62, 14, GREY_LIGHT);
  disc(x + 148, y + 44, 18, GREY);
  disc(x + 182, y + 60, 12, GREY_LIGHT);
  // factory block with lit windows
  fillRect(x + 40, y + 128, 220, 44, INK);
  fillRect(x + 56, y + 138, 20, 14, YELLOW);
  fillRect(x + 92, y + 138, 20, 14, YELLOW);
  fillRect(x + 128, y + 138, 20, 14, ORANGE);
  fillRect(x + 164, y + 138, 20, 14, YELLOW);
  fillRect(x + 200, y + 138, 20, 14, YELLOW);
  // search lights sweeping the ruins
  thickLine(x + 60, y + 172, x + 30, y + 120, 2, WHITE);
  thickLine(x + 240, y + 172, x + 268, y + 122, 2, WHITE);
  rect(x, y, w, h, INK, 3);
}

// ---- front page -----------------------------------------------------------
function compose(): void {
  // masthead
  hline(30, 24, 964, INK, 3);
  centerText(30, 994, 38, "THE WORLD IN ONE DAY", 6, INK);
  hline(30, 88, 964, INK, 1);
  centerText(30, 994, 98, "TUESDAY, 24 NOVEMBER 2026", 3, INK);
  hline(30, 122, 964, INK, 3);

  // ---- lead story: island alert ------------------------------------------
  drawText(30, 140, "KOREA \u2022 ULLEUNG ISLAND", 2, RED);
  drawText(30, 166, "MYSTERY JET", 6, INK);
  drawText(30, 216, "ISLAND ALERT", 6, INK);
  paragraph(
    30,
    272,
    "South Korea briefly ordered residents of Ulleung Island to take shelter on Tuesday after an aircraft entered its airspace near the eastern island.",
    2,
    570,
    INK,
    15,
  );
  paragraph(
    30,
    332,
    "The alert, issued at 7:52 a.m., was lifted three minutes later. Officials first said the aircraft was Russian, then said it may have been North Korean.",
    2,
    570,
    INK,
    15,
  );
  drawText(30, 412, "CONTEXT:", 2, RED);
  paragraph(
    30,
    430,
    "It was the second airspace scare in a week after Russian warplanes entered Korea's air defence zone on 17 November.",
    2,
    570,
    INK,
    15,
  );
  leadPanel(620, 140, 374, 330);

  hline(30, 490, 964, INK, 3);

  // ---- Indonesia factory fire ---------------------------------------------
  factoryPanel(30, 510, 300, 210);
  drawText(350, 512, "INDONESIA \u2022 BANTEN PROVINCE", 2, RED);
  drawText(350, 538, "24 DEAD AS", 4, INK);
  drawText(350, 570, "FACTORY FIRE", 4, INK);
  drawText(350, 602, "SEARCH GOES ON", 4, INK);
  paragraph(
    350,
    640,
    "Indonesia confirmed 24 deaths in a candy factory fire as rescuers searched unstable ruins for about 30 workers still missing.",
    2,
    644,
    INK,
    15,
  );
  paragraph(
    350,
    700,
    "The blaze broke out on Saturday at the PT Fonusa Agung Mulia plant in Cikande; officials say an air-conditioner short circuit may have started it.",
    2,
    644,
    INK,
    15,
  );

  hline(30, 745, 964, INK, 3);

  // ---- bottom row: three more stories -------------------------------------
  // Ukraine
  drawText(30, 762, "UKRAINE \u2022 KYIV REGION", 2, RED);
  drawText(30, 784, "DRONE STRIKE", 3, INK);
  drawText(30, 806, "HITS KYIV", 3, INK);
  drawText(30, 828, "REGION", 3, INK);
  paragraph(
    30,
    854,
    "Russian drone and missile strikes hit the Kyiv region. Several people are missing.",
    2,
    308,
    INK,
    15,
  );
  // Ukraine icon: skyline under a dark sky, one building burning
  fillRect(30, 918, 308, 42, DARK);
  disc(120, 934, 15, ORANGE);
  fillRect(48, 928, 44, 32, INK);
  fillRect(108, 918, 52, 42, INK);
  fillRect(176, 932, 40, 28, INK);
  fillRect(232, 924, 52, 36, INK);
  fillRect(58, 936, 8, 8, YELLOW);
  fillRect(122, 932, 8, 8, YELLOW);
  fillRect(246, 934, 8, 8, YELLOW);

  // Baltic Sea
  drawText(358, 762, "BALTIC SEA \u2022 FINLAND", 2, RED);
  drawText(358, 784, "CARGO SHIP", 3, INK);
  drawText(358, 806, "BURNS AFTER", 3, INK);
  drawText(358, 828, "DRONE HIT", 3, INK);
  paragraph(
    358,
    854,
    "Russian cargo ship Sparta II catches fire in the Gulf of Finland after a drone attack.",
    2,
    308,
    INK,
    15,
  );
  // Baltic icon: a ship on the sea, flame and smoke above the hull
  fillRect(358, 918, 308, 42, SEA);
  hline(358, 934, 308, SEA_LIGHT, 2);
  fillTriangle(468, 942, 500, 942, 484, 918, ORANGE);
  disc(484, 912, 9, GREY_LIGHT);
  fillRect(398, 942, 180, 12, INK);
  fillTriangle(578, 942, 578, 954, 596, 948, INK);
  fillRect(420, 928, 40, 12, RED);
  fillRect(466, 928, 40, 12, BLUE);
  fillRect(512, 928, 40, 12, GREEN);

  // Lisbon
  drawText(686, 762, "PORTUGAL \u2022 LISBON", 2, RED);
  drawText(686, 784, "THOUSANDS", 3, INK);
  drawText(686, 806, "MARCH OVER", 3, INK);
  drawText(686, 828, "PRICE RISES", 3, INK);
  paragraph(
    686,
    854,
    "Thousands march in Lisbon against rising living costs as prices squeeze households.",
    2,
    308,
    INK,
    15,
  );
  // Lisbon icon: a street crowd with placards
  fillRect(686, 918, 308, 42, GREY_LIGHT);
  fillRect(686, 918, 308, 8, GREY_DARK);
  const crowd: Array<[number, number, RGB]> = [
    [710, 940, RED], [742, 944, BLUE], [774, 940, GREEN], [806, 944, ORANGE],
    [838, 940, RED], [870, 944, BLUE], [902, 940, GREEN], [934, 944, ORANGE],
    [726, 952, INK], [758, 954, INK], [790, 952, INK], [822, 954, INK],
    [854, 952, INK], [886, 954, INK], [918, 952, INK], [950, 954, INK],
  ];
  for (const [cx, cy, c] of crowd) disc(cx, cy, 6, c);
  fillRect(730, 922, 4, 14, INK);
  fillRect(718, 918, 28, 12, WHITE);
  rect(718, 918, 28, 12, INK, 1);
  fillRect(858, 922, 4, 14, INK);
  fillRect(846, 918, 28, 12, WHITE);
  rect(846, 918, 28, 12, INK, 1);

  // ---- footer ticker ------------------------------------------------------
  hline(30, 975, 964, INK, 2);
  drawText(30, 986, "ALSO TODAY: NATO calls urgent meeting - COP31 fallout turns to COP32", 2, INK);
  drawText(30, 1004, "Chess title match opens in Geneva - Verstappen wins the Las Vegas GP", 2, INK);
}

compose();

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "entry.png"), encodePng());
