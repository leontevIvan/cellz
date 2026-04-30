import Phaser from 'phaser';

const PI2 = Math.PI * 2;

/** Fill a deformed (organic) ellipse, optionally rotated by `rot` radians */
export function fillBlob(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  p1: number, p2: number, p3: number,
  n = 28, rot = 0,
) {
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * PI2;
    const d = 1
      + 0.17 * Math.sin(a * 2 - p1)
      + 0.11 * Math.sin(a * 3 + p2 * 0.8)
      + 0.08 * Math.cos(a * 4 - p3)
      + 0.05 * Math.sin(a * 5 + p1 * 0.5)
      + 0.04 * Math.sin(a      + p2 * 0.3)
      + 0.03 * Math.cos(a * 6 - p3 * 0.6);
    const bx = Math.cos(a) * rx * d;
    const by = Math.sin(a) * ry * d;
    const x = cx + bx * cosR - by * sinR;
    const y = cy + bx * sinR + by * cosR;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
}

/** Stroke a deformed (organic) ellipse, optionally rotated by `rot` radians */
export function strokeBlob(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  p1: number, p2: number, p3: number,
  n = 28, rot = 0,
) {
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * PI2;
    const d = 1
      + 0.17 * Math.sin(a * 2 - p1)
      + 0.11 * Math.sin(a * 3 + p2 * 0.8)
      + 0.08 * Math.cos(a * 4 - p3)
      + 0.05 * Math.sin(a * 5 + p1 * 0.5)
      + 0.04 * Math.sin(a      + p2 * 0.3)
      + 0.03 * Math.cos(a * 6 - p3 * 0.6);
    const bx = Math.cos(a) * rx * d;
    const by = Math.sin(a) * ry * d;
    const x = cx + bx * cosR - by * sinR;
    const y = cy + bx * sinR + by * cosR;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.strokePath();
}

/** Spiky cell — 5-fold sharp spines with finer serration between them */
export function fillSpikyBlob(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  p1: number, p2: number, p3: number,
  n = 48, rot = 0,
) {
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * PI2;
    const d = 1
      + 0.40 * Math.sin(a * 5 - p1)           // 5 main spines
      + 0.18 * Math.sin(a * 8 + p2 * 0.7)     // 8 secondary spines
      + 0.10 * Math.cos(a * 3 - p3 * 0.8)     // 3-fold asymmetry
      + 0.06 * Math.sin(a * 11 + p1 * 0.4)    // fine serration
      + 0.04 * Math.cos(a *  2 + p2 * 0.3);   // slow lean
    const bx = Math.cos(a) * rx * d;
    const by = Math.sin(a) * ry * d;
    const x = cx + bx * cosR - by * sinR;
    const y = cy + bx * sinR + by * cosR;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
}

/** Stroke spiky cell */
export function strokeSpikyBlob(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  p1: number, p2: number, p3: number,
  n = 48, rot = 0,
) {
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * PI2;
    const d = 1
      + 0.40 * Math.sin(a * 5 - p1)
      + 0.18 * Math.sin(a * 8 + p2 * 0.7)
      + 0.10 * Math.cos(a * 3 - p3 * 0.8)
      + 0.06 * Math.sin(a * 11 + p1 * 0.4)
      + 0.04 * Math.cos(a *  2 + p2 * 0.3);
    const bx = Math.cos(a) * rx * d;
    const by = Math.sin(a) * ry * d;
    const x = cx + bx * cosR - by * sinR;
    const y = cy + bx * sinR + by * cosR;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.strokePath();
}

/** Amoeba — many-lobed pseudopod shape with high-frequency surface texture */
export function fillAmoeba(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  p1: number, p2: number, p3: number,
  n = 40, rot = 0,
) {
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * PI2;
    const d = 1
      + 0.22 * Math.sin(a * 2 - p1)           // primary lobe
      + 0.18 * Math.sin(a * 3 + p2)           // secondary lobe
      + 0.14 * Math.cos(a * 4 - p3 * 0.9)    // tertiary lobe
      + 0.11 * Math.sin(a * 5 + p1 * 0.7)    // fine pseudopods
      + 0.08 * Math.cos(a * 7 - p2 * 0.5)    // surface bumps
      + 0.05 * Math.sin(a * 9 + p3 * 0.4)    // micro-bumps
      + 0.03 * Math.cos(a * 11 - p1 * 0.3);  // surface texture
    const bx = Math.cos(a) * rx * d;
    const by = Math.sin(a) * ry * d;
    const x = cx + bx * cosR - by * sinR;
    const y = cy + bx * sinR + by * cosR;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
}

/** Stroke amoeba */
export function strokeAmoeba(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  p1: number, p2: number, p3: number,
  n = 40, rot = 0,
) {
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * PI2;
    const d = 1
      + 0.22 * Math.sin(a * 2 - p1)
      + 0.18 * Math.sin(a * 3 + p2)
      + 0.14 * Math.cos(a * 4 - p3 * 0.9)
      + 0.11 * Math.sin(a * 5 + p1 * 0.7)
      + 0.08 * Math.cos(a * 7 - p2 * 0.5)
      + 0.05 * Math.sin(a * 9 + p3 * 0.4)
      + 0.03 * Math.cos(a * 11 - p1 * 0.3);
    const bx = Math.cos(a) * rx * d;
    const by = Math.sin(a) * ry * d;
    const x = cx + bx * cosR - by * sinR;
    const y = cy + bx * sinR + by * cosR;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.strokePath();
}

/** Wavy flagellum from the back of the cell */
export function drawFlagellum(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  r: number, dir: number,
  phase: number, color: number,
) {
  const bx  = cx - Math.cos(dir) * r * 0.85;
  const by  = cy - Math.sin(dir) * r * 0.85;
  const len = r * 2.4;
  const n   = 20;
  g.lineStyle(1.4, color, 0.45);
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const t    = i / n;
    const dist = t * len;
    const amp  = r * 0.38 * t * Math.max(0, 1 - t * 0.55);
    const wave = Math.sin(phase * 2.6 - t * Math.PI * 2.8) * amp;
    const x = bx - Math.cos(dir) * dist + Math.sin(dir) * wave;
    const y = by - Math.sin(dir) * dist - Math.cos(dir) * wave;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.strokePath();
}

/** Two side-by-side flagella for elongated cells */
export function drawTwinFlagella(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  r: number, dir: number,
  phase: number, color: number,
) {
  const perpX = -Math.sin(dir);
  const perpY =  Math.cos(dir);
  const spread = r * 0.20;

  for (let s = -1; s <= 1; s += 2) {
    const bx  = cx - Math.cos(dir) * r * 0.85 + perpX * spread * s;
    const by  = cy - Math.sin(dir) * r * 0.85 + perpY * spread * s;
    const len = r * 2.0;
    const n   = 18;
    g.lineStyle(1.1, color, 0.42);
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const t    = i / n;
      const dist = t * len;
      const amp  = r * 0.28 * t * Math.max(0, 1 - t * 0.50);
      const wave = Math.sin(phase * 2.6 - t * Math.PI * 2.8 + s * 0.4) * amp;
      const x = bx - Math.cos(dir) * dist + Math.sin(dir) * wave;
      const y = by - Math.sin(dir) * dist - Math.cos(dir) * wave;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.strokePath();
  }
}

/** Short radial pseudopod tendrils for amoeba cells */
export function drawPseudopods(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  r: number,
  phase: number, color: number,
) {
  const count = 6;
  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * PI2 + phase * 0.18;
    const len = r * (0.55 + 0.25 * Math.sin(phase * 0.7 + i * 1.3));
    const n   = 10;
    g.lineStyle(1.6, color, 0.28);
    g.beginPath();
    g.moveTo(cx + Math.cos(baseAngle) * r * 0.88, cy + Math.sin(baseAngle) * r * 0.88);
    for (let j = 1; j <= n; j++) {
      const t    = j / n;
      const dist = t * len;
      const sway = Math.sin(phase * 1.4 + i * 0.9 + t * Math.PI) * r * 0.10 * t;
      const a    = baseAngle + sway / (r + 0.01);
      g.lineTo(
        cx + Math.cos(baseAngle) * r * 0.88 + Math.cos(a) * dist,
        cy + Math.sin(baseAngle) * r * 0.88 + Math.sin(a) * dist,
      );
    }
    g.strokePath();
  }
}

/** Biological eye: sclera → iris → pupil → glint */
export function drawBioEye(
  g: Phaser.GameObjects.Graphics,
  ex: number, ey: number,
  eyeR: number, irisColor: number,
  dir: number,
) {
  const lx = Math.cos(dir) * eyeR * 0.20;
  const ly = Math.sin(dir) * eyeR * 0.20;
  g.fillStyle(0xe8f4ee, 0.90);
  g.fillCircle(ex, ey, eyeR);
  g.fillStyle(irisColor, 0.85);
  g.fillCircle(ex + lx, ey + ly, eyeR * 0.60);
  g.fillStyle(0x040810, 1);
  g.fillCircle(ex + lx, ey + ly, eyeR * 0.34);
  g.fillStyle(0xffffff, 0.78);
  g.fillCircle(ex + lx - eyeR * 0.14, ey + ly - eyeR * 0.15, eyeR * 0.18);
}

/** Sharp mandibles — pointed claw/fang shapes like insect mouthparts */
export function drawMandibles(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  r: number, dir: number,
  bodyColor: number, membraneColor: number,
  open: boolean,
) {
  const fwdX  =  Math.cos(dir);
  const fwdY  =  Math.sin(dir);
  const perpX = -Math.sin(dir);
  const perpY =  Math.cos(dir);

  const sx = cx + fwdX * r * 0.58;
  const sy = cy + fwdY * r * 0.58;
  const openAdd = open ? r * 0.14 : 0;

  for (const side of [-1, 1] as const) {
    const s = side as number;

    const b1x = sx + perpX * (r * 0.50 + openAdd) * s;
    const b1y = sy + perpY * (r * 0.50 + openAdd) * s;
    const b2x = sx + perpX * (r * 0.17 + openAdd * 0.22) * s;
    const b2y = sy + perpY * (r * 0.17 + openAdd * 0.22) * s;

    const mx = sx + fwdX * r * 0.28 + perpX * (r * 0.46 + openAdd * 0.55) * s;
    const my = sy + fwdY * r * 0.28 + perpY * (r * 0.46 + openAdd * 0.55) * s;

    const tx = sx + fwdX * r * 0.72 + perpX * r * 0.05 * s;
    const ty = sy + fwdY * r * 0.72 + perpY * r * 0.05 * s;

    g.fillStyle(0x000000, 0.18);
    g.beginPath();
    g.moveTo(b1x + 1, b1y + 2);
    g.lineTo(mx   + 1, my   + 2);
    g.lineTo(tx   + 1, ty   + 2);
    g.lineTo(b2x  + 1, b2y  + 2);
    g.closePath();
    g.fillPath();

    g.fillStyle(bodyColor, 0.94);
    g.beginPath();
    g.moveTo(b1x, b1y);
    g.lineTo(mx,  my);
    g.lineTo(tx,  ty);
    g.lineTo(b2x, b2y);
    g.closePath();
    g.fillPath();

    g.fillStyle(membraneColor, 0.32);
    g.beginPath();
    g.moveTo(b1x, b1y);
    g.lineTo(mx,  my);
    g.lineTo(tx,  ty);
    g.closePath();
    g.fillPath();

    g.lineStyle(1.5, membraneColor, 0.78);
    g.beginPath();
    g.moveTo(b1x, b1y);
    g.lineTo(mx,  my);
    g.lineTo(tx,  ty);
    g.lineTo(b2x, b2y);
    g.closePath();
    g.strokePath();
  }
}
