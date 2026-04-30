import Phaser from 'phaser';
import {
  fillBlob, strokeBlob,
  fillSpikyBlob, strokeSpikyBlob,
  fillAmoeba, strokeAmoeba,
  drawFlagellum, drawTwinFlagella, drawPseudopods,
  drawBioEye, drawMandibles,
} from './cellHelpers';

type Palette = { body: number; membrane: number; nucleus: number; };
export type CellShape = 'blob' | 'spiky' | 'elongated' | 'amoeba';

// ── Palettes per shape ────────────────────────────────────────────────────────

const BLOB_PALETTES: Palette[] = [
  { body: 0x80b8e0, membrane: 0xa8d8f8, nucleus: 0x1e4870 },
  { body: 0xc8982a, membrane: 0xf0c040, nucleus: 0x603808 },
  { body: 0x50aa68, membrane: 0x78d090, nucleus: 0x185030 },
  { body: 0xb06888, membrane: 0xd890b0, nucleus: 0x501830 },
];

const SPIKY_PALETTES: Palette[] = [
  { body: 0xc84018, membrane: 0xf06030, nucleus: 0x580808 },
  { body: 0xb83010, membrane: 0xe04820, nucleus: 0x4a0a08 },
  { body: 0xc89020, membrane: 0xf0b030, nucleus: 0x5c3c00 },
  { body: 0xd05818, membrane: 0xf08030, nucleus: 0x601008 },
];

const ELONGATED_PALETTES: Palette[] = [
  { body: 0x3090c8, membrane: 0x58b8e8, nucleus: 0x0c2c50 },
  { body: 0x28a098, membrane: 0x50c8c0, nucleus: 0x083030 },
  { body: 0x5068b0, membrane: 0x7890d0, nucleus: 0x181838 },
  { body: 0x208898, membrane: 0x40b0c0, nucleus: 0x082830 },
];

const AMOEBA_PALETTES: Palette[] = [
  { body: 0x5038a8, membrane: 0x7860d0, nucleus: 0x180848 },
  { body: 0x286888, membrane: 0x4090b0, nucleus: 0x081c30 },
  { body: 0x783080, membrane: 0xa058a8, nucleus: 0x280830 },
  { body: 0x3848a0, membrane: 0x6070c8, nucleus: 0x0c1440 },
];

const BIG_PALETTES: Palette[] = [
  { body: 0x8a1818, membrane: 0xc83030, nucleus: 0x380808 },
  { body: 0x6a1060, membrane: 0xa030a0, nucleus: 0x2a0428 },
];

export class EnemyCell {
  scene: Phaser.Scene;
  x: number; y: number;
  radius: number; maxRadius: number;
  hp: number; maxHp: number;
  vx: number; vy: number;
  speed: number;
  isBig: boolean;
  shape: CellShape;
  palette: Palette;
  rxFactor: number; ryFactor: number;
  bp1: number; bp2: number; bp3: number;
  bpRate1: number; bpRate2: number; bpRate3: number;
  nucleusOx: number; nucleusOy: number;
  vacuoles: { ox: number; oy: number; vr: number }[];
  finPhase: number;
  alive: boolean;
  isBiting = false;
  aggroRange: number;

  wanderVx: number;
  wanderVy: number;
  wanderTimer: number;

  get color() { return this.palette.body; }

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    speed: number, radius: number,
    big = false,
    shape: CellShape = 'blob',
  ) {
    this.scene  = scene;
    this.x = x; this.y = y;
    this.speed  = speed;
    this.isBig  = big;
    this.shape  = big ? 'blob' : shape;

    // HP multiplier per shape
    const hpMult = shape === 'spiky' ? 0.70 : shape === 'elongated' ? 0.82 : shape === 'amoeba' ? 1.50 : 1.0;
    this.radius    = radius;
    this.maxRadius = radius;
    this.hp        = radius * hpMult;
    this.maxHp     = radius * hpMult;

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    // shape-specific palette
    this.palette = big ? Phaser.Utils.Array.GetRandom(BIG_PALETTES)
      : shape === 'spiky'    ? Phaser.Utils.Array.GetRandom(SPIKY_PALETTES)
      : shape === 'elongated' ? Phaser.Utils.Array.GetRandom(ELONGATED_PALETTES)
      : shape === 'amoeba'   ? Phaser.Utils.Array.GetRandom(AMOEBA_PALETTES)
      : Phaser.Utils.Array.GetRandom(BLOB_PALETTES);

    // shape-specific proportions
    if (shape === 'elongated') {
      this.rxFactor = Phaser.Math.FloatBetween(1.90, 2.30);
      this.ryFactor = Phaser.Math.FloatBetween(0.35, 0.46);
    } else if (big) {
      this.rxFactor = Phaser.Math.FloatBetween(0.88, 1.14);
      this.ryFactor = Phaser.Math.FloatBetween(0.80, 0.98);
    } else {
      this.rxFactor = Phaser.Math.FloatBetween(0.88, 1.14);
      this.ryFactor = Phaser.Math.FloatBetween(0.88, 1.14);
    }

    this.bp1 = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.bp2 = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.bp3 = Phaser.Math.FloatBetween(0, Math.PI * 2);

    // shape-specific phase evolution rates
    if (shape === 'spiky') {
      this.bpRate1 = 3.50; this.bpRate2 = 2.80; this.bpRate3 = 4.50;
    } else if (shape === 'elongated') {
      this.bpRate1 = 1.80; this.bpRate2 = 1.20; this.bpRate3 = 2.50;
    } else if (shape === 'amoeba') {
      this.bpRate1 = 0.75; this.bpRate2 = 0.52; this.bpRate3 = 1.10;
    } else {
      this.bpRate1 = 2.20; this.bpRate2 = 1.55; this.bpRate3 = 3.00;
    }

    this.nucleusOx = Phaser.Math.FloatBetween(-0.38, 0.38);
    this.nucleusOy = Phaser.Math.FloatBetween(-0.38, 0.38);
    this.vacuoles  = Array.from({ length: Phaser.Math.Between(2, 4) }, () => ({
      ox: Phaser.Math.FloatBetween(-0.52, 0.52),
      oy: Phaser.Math.FloatBetween(-0.52, 0.52),
      vr: Phaser.Math.FloatBetween(0.06, 0.13),
    }));

    this.finPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.alive    = true;

    // aggro range per shape
    this.aggroRange = big ? 210
      : shape === 'spiky'    ? 240
      : shape === 'elongated' ? 200
      : shape === 'amoeba'   ? 130
      : 150;

    // wander timer per shape (spiky changes direction often)
    const [wMin, wMax] = shape === 'spiky' ? [0.5, 1.5]
      : shape === 'elongated'              ? [1.5, 3.5]
      : shape === 'amoeba'                 ? [2.0, 4.5]
      :                                      [1.2, 3.0];

    this.wanderVx    = this.vx;
    this.wanderVy    = this.vy;
    this.wanderTimer = Phaser.Math.FloatBetween(wMin, wMax);
  }

  takeDamage(amount: number) {
    this.hp -= amount;
    this.radius = Math.max(6, this.maxRadius * (this.hp / this.maxHp));
    if (this.hp <= 0) this.alive = false;
  }

  eatFood(foodRadius: number) {
    const gain = foodRadius * 0.6;
    this.maxRadius += gain;
    this.maxHp     += gain;
    this.hp = Math.min(this.hp + gain, this.maxHp);
    this.radius = this.maxRadius * (this.hp / this.maxHp);
  }

  update(delta: number, width: number, height: number, targetX?: number, targetY?: number) {
    const dt = delta / 1000;
    this.bp1      += dt * this.bpRate1;
    this.bp2      += dt * this.bpRate2;
    this.bp3      += dt * this.bpRate3;
    this.finPhase += dt * 2.8;

    const [wMin, wMax] = this.shape === 'spiky' ? [0.5, 1.5]
      : this.shape === 'elongated'              ? [1.5, 3.5]
      : this.shape === 'amoeba'                 ? [2.0, 4.5]
      :                                           [1.2, 3.0];

    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      const a         = Math.random() * Math.PI * 2;
      this.wanderVx    = Math.cos(a) * this.speed;
      this.wanderVy    = Math.sin(a) * this.speed;
      this.wanderTimer = Phaser.Math.FloatBetween(wMin, wMax);
    }

    let tvx = this.wanderVx;
    let tvy = this.wanderVy;

    if (targetX !== undefined && targetY !== undefined) {
      const dist = Math.hypot(targetX - this.x, targetY - this.y);
      if (dist < this.aggroRange) {
        const d = dist || 1;
        tvx = ((targetX - this.x) / d) * this.speed;
        tvy = ((targetY - this.y) / d) * this.speed;
      }
    }

    const turn = this.isBig ? 0.38
      : this.shape === 'spiky'    ? 1.40
      : this.shape === 'elongated' ? 0.50
      : this.shape === 'amoeba'   ? 0.55
      : 0.75;

    this.vx = Phaser.Math.Linear(this.vx, tvx, Math.min(1, turn * dt));
    this.vy = Phaser.Math.Linear(this.vy, tvy, Math.min(1, turn * dt));

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x < this.radius || this.x > width - this.radius) {
      this.vx *= -0.8; this.wanderVx = this.vx;
    }
    if (this.y < this.radius || this.y > height - this.radius) {
      this.vy *= -0.8; this.wanderVy = this.vy;
    }
    this.x = Phaser.Math.Clamp(this.x, this.radius, width  - this.radius);
    this.y = Phaser.Math.Clamp(this.y, this.radius, height - this.radius);
  }

  draw(gfx: Phaser.GameObjects.Graphics) {
    if (this.shape === 'spiky')    { this.drawSpiky(gfx);    return; }
    if (this.shape === 'elongated') { this.drawElongated(gfx); return; }
    if (this.shape === 'amoeba')   { this.drawAmoeba(gfx);   return; }
    this.drawBlob(gfx);
  }

  // ── Blob (default) ─────────────────────────────────────────────────────────

  private drawBlob(gfx: Phaser.GameObjects.Graphics) {
    const r   = this.radius;
    const dir = Math.atan2(this.vy, this.vx);
    const p   = this.palette;
    const { bp1: p1, bp2: p2, bp3: p3 } = this;

    const spd     = Math.hypot(this.vx, this.vy);
    const sf      = Math.min(1, spd / (this.speed * 1.1));
    const pulse   = 1 + 0.09 * Math.sin(this.finPhase * 0.38);
    const stretch = (1 + 0.28 * sf) * pulse;
    const rx  = r * this.rxFactor * stretch;
    const ry  = r * this.ryFactor / stretch;
    const cosD = Math.cos(dir);
    const sinD = Math.sin(dir);

    if (this.isBig) {
      gfx.lineStyle(3, p.membrane, 0.35);
      gfx.strokeCircle(this.x, this.y, r * 1.22);
    }

    drawFlagellum(gfx, this.x, this.y, r, dir, this.finPhase, p.membrane);

    const bodyAlpha  = this.isBig ? 0.70 : 0.52;
    const innerAlpha = this.isBig ? 0.28 : 0.20;

    gfx.fillStyle(p.body, bodyAlpha);
    fillBlob(gfx, this.x, this.y, rx, ry, p1, p2, p3, 28, dir);
    gfx.fillStyle(p.body, innerAlpha);
    fillBlob(gfx, this.x, this.y, rx * 0.70, ry * 0.70, p1 + 0.5, p2 + 0.4, p3 - 0.3, 28, dir);

    for (const v of this.vacuoles) {
      const vx = this.x + (v.ox * cosD - v.oy * sinD) * r * 0.72;
      const vy = this.y + (v.ox * sinD + v.oy * cosD) * r * 0.72;
      const vr = v.vr * r;
      gfx.fillStyle(p.nucleus, 0.20); gfx.fillCircle(vx, vy, vr);
      gfx.lineStyle(0.5, p.membrane, 0.24); gfx.strokeCircle(vx, vy, vr);
    }

    const nr = r * (this.isBig ? 0.38 : 0.31);
    const nx = this.x + (this.nucleusOx * cosD - this.nucleusOy * sinD) * r * 0.36;
    const ny = this.y + (this.nucleusOx * sinD + this.nucleusOy * cosD) * r * 0.36;
    gfx.fillStyle(p.nucleus, this.isBig ? 0.82 : 0.65);
    fillBlob(gfx, nx, ny, nr, nr * 0.88, p1 * 0.6, p2 * 0.7, p3 * 0.5);
    gfx.lineStyle(0.8, p.membrane, 0.42);
    strokeBlob(gfx, nx, ny, nr, nr * 0.88, p1 * 0.6, p2 * 0.7, p3 * 0.5);

    gfx.lineStyle(Math.max(1.2, r * (this.isBig ? 0.055 : 0.045)), p.membrane, this.isBig ? 0.85 : 0.75);
    strokeBlob(gfx, this.x, this.y, rx, ry, p1, p2, p3, 28, dir);

    gfx.fillStyle(p.membrane, 0.10);
    gfx.fillEllipse(this.x - r * 0.18, this.y - r * 0.22, r * 0.52, r * 0.30);

    this.drawHpBar(gfx, r);

    const eyeR = r * (this.isBig ? 0.20 : 0.22);
    drawBioEye(gfx, this.x + Math.cos(dir) * r * 0.38, this.y + Math.sin(dir) * r * 0.38, eyeR, p.nucleus, dir);
    drawMandibles(gfx, this.x, this.y, r, dir, p.body, p.membrane, this.isBiting);
  }

  // ── Spiky ──────────────────────────────────────────────────────────────────

  private drawSpiky(gfx: Phaser.GameObjects.Graphics) {
    const r   = this.radius;
    const dir = Math.atan2(this.vy, this.vx);
    const p   = this.palette;
    const { bp1: p1, bp2: p2, bp3: p3 } = this;

    const spd     = Math.hypot(this.vx, this.vy);
    const sf      = Math.min(1, spd / (this.speed * 1.1));
    const pulse   = 1 + 0.06 * Math.sin(this.finPhase * 0.42);
    const stretch = (1 + 0.14 * sf) * pulse;
    const rx  = r * this.rxFactor * stretch;
    const ry  = r * this.ryFactor / stretch;

    // dark spine shadow
    gfx.fillStyle(0x000000, 0.20);
    fillSpikyBlob(gfx, this.x + 1, this.y + 2, rx * 1.05, ry * 1.05, p1, p2, p3, 48, dir);

    // main body
    gfx.fillStyle(p.body, 0.65);
    fillSpikyBlob(gfx, this.x, this.y, rx, ry, p1, p2, p3, 48, dir);

    // inner highlight
    gfx.fillStyle(p.body, 0.22);
    fillBlob(gfx, this.x, this.y, rx * 0.55, ry * 0.55, p1 * 0.5, p2 * 0.5, p3 * 0.5, 24, dir);

    // nucleus (centered, sharp-looking)
    const nr = r * 0.28;
    gfx.fillStyle(p.nucleus, 0.88);
    fillSpikyBlob(gfx, this.x, this.y, nr, nr * 0.90, p1 * 1.2, p2 * 1.3, p3 * 1.1, 36, dir);
    gfx.lineStyle(0.8, p.membrane, 0.50);
    strokeSpikyBlob(gfx, this.x, this.y, nr, nr * 0.90, p1 * 1.2, p2 * 1.3, p3 * 1.1, 36, dir);

    // spine highlight outline
    gfx.lineStyle(Math.max(1.0, r * 0.040), p.membrane, 0.88);
    strokeSpikyBlob(gfx, this.x, this.y, rx, ry, p1, p2, p3, 48, dir);

    this.drawHpBar(gfx, r);

    // small aggressive eye
    const eyeR = r * 0.18;
    drawBioEye(gfx, this.x + Math.cos(dir) * r * 0.30, this.y + Math.sin(dir) * r * 0.30, eyeR, p.nucleus, dir);

    // always looks aggressive — mandibles slightly open
    drawMandibles(gfx, this.x, this.y, r, dir, p.body, p.membrane, this.isBiting || true);
  }

  // ── Elongated (torpedo) ───────────────────────────────────────────────────

  private drawElongated(gfx: Phaser.GameObjects.Graphics) {
    const r   = this.radius;
    const dir = Math.atan2(this.vy, this.vx);
    const p   = this.palette;
    const { bp1: p1, bp2: p2, bp3: p3 } = this;

    const spd     = Math.hypot(this.vx, this.vy);
    const sf      = Math.min(1, spd / (this.speed * 1.1));
    const pulse   = 1 + 0.05 * Math.sin(this.finPhase * 0.30);
    const stretch = (1 + 0.10 * sf) * pulse;
    // elongated cells use their pre-set extreme rx/ry factors — minimal extra stretch
    const rx  = r * this.rxFactor * stretch;
    const ry  = r * this.ryFactor / stretch;
    const cosD = Math.cos(dir);
    const sinD = Math.sin(dir);

    // twin flagella at rear
    drawTwinFlagella(gfx, this.x, this.y, r, dir, this.finPhase, p.membrane);

    // smooth torpedo body (reduced harmonics for clean shape)
    gfx.fillStyle(p.body, 0.58);
    fillBlob(gfx, this.x, this.y, rx, ry, p1 * 0.35, p2 * 0.35, p3 * 0.35, 32, dir);

    // inner sheen
    gfx.fillStyle(p.membrane, 0.14);
    fillBlob(gfx, this.x - cosD * r * 0.18, this.y - sinD * r * 0.18, rx * 0.52, ry * 0.52, p1 * 0.2, p2 * 0.2, p3 * 0.2, 24, dir);

    // slim nucleus aligned with body axis
    const nr = r * 0.26;
    const nx = this.x + (this.nucleusOx * cosD - this.nucleusOy * sinD) * r * 0.28;
    const ny = this.y + (this.nucleusOx * sinD + this.nucleusOy * cosD) * r * 0.28;
    gfx.fillStyle(p.nucleus, 0.72);
    fillBlob(gfx, nx, ny, nr * 1.4, nr * 0.70, p1 * 0.3, p2 * 0.3, p3 * 0.3, 20, dir);

    gfx.lineStyle(Math.max(1.0, r * 0.038), p.membrane, 0.80);
    strokeBlob(gfx, this.x, this.y, rx, ry, p1 * 0.35, p2 * 0.35, p3 * 0.35, 32, dir);

    // specular sheen on top
    gfx.fillStyle(p.membrane, 0.18);
    gfx.fillEllipse(this.x - cosD * r * 0.10, this.y - sinD * r * 0.10, rx * 0.52, ry * 0.38);

    this.drawHpBar(gfx, r);

    // small, forward-mounted eye
    const eyeR = r * 0.19;
    drawBioEye(gfx, this.x + cosD * r * 0.50, this.y + sinD * r * 0.50, eyeR, p.nucleus, dir);

    drawMandibles(gfx, this.x, this.y, r * 0.55, dir, p.body, p.membrane, this.isBiting);
  }

  // ── Amoeba ────────────────────────────────────────────────────────────────

  private drawAmoeba(gfx: Phaser.GameObjects.Graphics) {
    const r   = this.radius;
    const p   = this.palette;
    const { bp1: p1, bp2: p2, bp3: p3 } = this;

    // amoeba has no fixed direction — use finPhase for drift orientation
    const dir  = this.finPhase * 0.12;
    const pulse = 1 + 0.12 * Math.sin(this.finPhase * 0.28);
    const rx    = r * this.rxFactor * pulse;
    const ry    = r * this.ryFactor * pulse;
    const cosD  = Math.cos(dir);
    const sinD  = Math.sin(dir);

    // pseudopod tendrils
    drawPseudopods(gfx, this.x, this.y, r, this.finPhase, p.membrane);

    // translucent outer cytoplasm
    gfx.fillStyle(p.body, 0.32);
    fillAmoeba(gfx, this.x, this.y, rx * 1.15, ry * 1.15, p1 * 0.8, p2 * 0.8, p3 * 0.8, 40, dir);

    // main body
    gfx.fillStyle(p.body, 0.58);
    fillAmoeba(gfx, this.x, this.y, rx, ry, p1, p2, p3, 40, dir);

    // inner organelle layer
    gfx.fillStyle(p.body, 0.22);
    fillAmoeba(gfx, this.x, this.y, rx * 0.62, ry * 0.62, p1 + 0.8, p2 + 0.6, p3 - 0.5, 32, dir);

    // vacuoles (prominent in amoeba)
    for (const v of this.vacuoles) {
      const vx = this.x + (v.ox * cosD - v.oy * sinD) * r * 0.60;
      const vy = this.y + (v.ox * sinD + v.oy * cosD) * r * 0.60;
      const vr = v.vr * r * 1.4;
      gfx.fillStyle(p.nucleus, 0.28); gfx.fillCircle(vx, vy, vr);
      gfx.lineStyle(0.8, p.membrane, 0.30); gfx.strokeCircle(vx, vy, vr);
    }

    // large central nucleus
    const nr = r * 0.40;
    gfx.fillStyle(p.nucleus, 0.78);
    fillBlob(gfx, this.x, this.y, nr, nr * 0.88, p1 * 0.4, p2 * 0.5, p3 * 0.3, 20);
    gfx.lineStyle(1.2, p.membrane, 0.48);
    strokeBlob(gfx, this.x, this.y, nr, nr * 0.88, p1 * 0.4, p2 * 0.5, p3 * 0.3, 20);

    // membrane outline
    gfx.lineStyle(Math.max(1.4, r * 0.048), p.membrane, 0.68);
    strokeAmoeba(gfx, this.x, this.y, rx, ry, p1, p2, p3, 40, dir);

    this.drawHpBar(gfx, r);
  }

  // ── Shared utilities ─────────────────────────────────────────────────────

  private drawHpBar(gfx: Phaser.GameObjects.Graphics, r: number) {
    if (this.hp >= this.maxHp - 0.5) return;
    const bw = r * 1.7, bh = this.isBig ? 7 : 5;
    const bx = this.x - bw / 2, by = this.y - r - 15;
    gfx.fillStyle(0x000000, 0.50);
    gfx.fillRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 2);
    gfx.fillStyle(0x1a1010, 1);
    gfx.fillRoundedRect(bx, by, bw, bh, 2);
    const col = this.isBig ? 0xd84040
      : this.shape === 'spiky'    ? 0xe05828
      : this.shape === 'elongated' ? 0x3898d8
      : this.shape === 'amoeba'   ? 0x7858c8
      : 0x38a868;
    gfx.fillStyle(col, 1);
    gfx.fillRoundedRect(bx, by, bw * (this.hp / this.maxHp), bh, 2);
  }
}
