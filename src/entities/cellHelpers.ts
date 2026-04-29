import Phaser from 'phaser';

const PI2 = Math.PI * 2;

/** Fill a deformed (organic) ellipse */
export function fillBlob(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  p1: number, p2: number, p3: number,
  n = 28,
) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * PI2;
    const d = 1
      + 0.13 * Math.sin(a * 2 + p1)
      + 0.09 * Math.sin(a * 3 + p2)
      + 0.06 * Math.cos(a * 5 + p3);
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.fillPath();
}

/** Stroke a deformed (organic) ellipse */
export function strokeBlob(
  g: Phaser.GameObjects.Graphics,
  cx: number, cy: number,
  rx: number, ry: number,
  p1: number, p2: number, p3: number,
  n = 28,
) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * PI2;
    const d = 1
      + 0.13 * Math.sin(a * 2 + p1)
      + 0.09 * Math.sin(a * 3 + p2)
      + 0.06 * Math.cos(a * 5 + p3);
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d;
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

    // base — wide attachment to cell
    const b1x = sx + perpX * (r * 0.50 + openAdd) * s;
    const b1y = sy + perpY * (r * 0.50 + openAdd) * s;
    const b2x = sx + perpX * (r * 0.17 + openAdd * 0.22) * s;
    const b2y = sy + perpY * (r * 0.17 + openAdd * 0.22) * s;

    // outer mid (mandible bulges outward)
    const mx = sx + fwdX * r * 0.28 + perpX * (r * 0.46 + openAdd * 0.55) * s;
    const my = sy + fwdY * r * 0.28 + perpY * (r * 0.46 + openAdd * 0.55) * s;

    // sharp tip — nearly at centreline
    const tx = sx + fwdX * r * 0.72 + perpX * r * 0.05 * s;
    const ty = sy + fwdY * r * 0.72 + perpY * r * 0.05 * s;

    // shadow
    g.fillStyle(0x000000, 0.18);
    g.beginPath();
    g.moveTo(b1x + 1, b1y + 2);
    g.lineTo(mx   + 1, my   + 2);
    g.lineTo(tx   + 1, ty   + 2);
    g.lineTo(b2x  + 1, b2y  + 2);
    g.closePath();
    g.fillPath();

    // main fill
    g.fillStyle(bodyColor, 0.94);
    g.beginPath();
    g.moveTo(b1x, b1y);
    g.lineTo(mx,  my);
    g.lineTo(tx,  ty);
    g.lineTo(b2x, b2y);
    g.closePath();
    g.fillPath();

    // highlight on outer face
    g.fillStyle(membraneColor, 0.32);
    g.beginPath();
    g.moveTo(b1x, b1y);
    g.lineTo(mx,  my);
    g.lineTo(tx,  ty);
    g.closePath();
    g.fillPath();

    // sharp outline
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
