import Phaser from 'phaser';
import { fillBlob, strokeBlob, drawFlagellum, drawBioEye, drawMandibles } from './cellHelpers';

type Palette = { body: number; membrane: number; nucleus: number; };

const PALETTES: Palette[] = [
  { body: 0x80b8e0, membrane: 0xa8d8f8, nucleus: 0x1e4870 },
  { body: 0xc8982a, membrane: 0xf0c040, nucleus: 0x603808 },
  { body: 0x50aa68, membrane: 0x78d090, nucleus: 0x185030 },
  { body: 0xb06888, membrane: 0xd890b0, nucleus: 0x501830 },
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
  palette: Palette;
  rxFactor: number; ryFactor: number;
  bp1: number; bp2: number; bp3: number;
  nucleusOx: number; nucleusOy: number;
  vacuoles: { ox: number; oy: number; vr: number }[];
  finPhase: number;
  alive: boolean;
  isBiting = false;

  // wander AI
  wanderVx: number;
  wanderVy: number;
  wanderTimer: number;

  get color() { return this.palette.body; }

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    speed: number, radius: number,
    big = false,
  ) {
    this.scene = scene;
    this.x = x; this.y = y;
    this.radius = radius; this.maxRadius = radius;
    this.hp = radius; this.maxHp = radius;
    this.speed = speed;
    this.isBig = big;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.palette   = big
      ? Phaser.Utils.Array.GetRandom(BIG_PALETTES)
      : Phaser.Utils.Array.GetRandom(PALETTES);
    this.rxFactor  = Phaser.Math.FloatBetween(0.88, 1.14);
    this.ryFactor  = big
      ? Phaser.Math.FloatBetween(0.80, 0.98)   // big enemies more elongated
      : Phaser.Math.FloatBetween(0.88, 1.14);
    this.bp1        = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.bp2        = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.bp3        = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.nucleusOx  = Phaser.Math.FloatBetween(-0.38, 0.38);
    this.nucleusOy  = Phaser.Math.FloatBetween(-0.38, 0.38);
    this.vacuoles   = Array.from({ length: Phaser.Math.Between(2, 4) }, () => ({
      ox: Phaser.Math.FloatBetween(-0.52, 0.52),
      oy: Phaser.Math.FloatBetween(-0.52, 0.52),
      vr: Phaser.Math.FloatBetween(0.06, 0.13),
    }));
    this.finPhase    = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.alive       = true;
    this.wanderVx    = this.vx;
    this.wanderVy    = this.vy;
    this.wanderTimer = Phaser.Math.FloatBetween(0.5, 3.0);
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
    this.bp1      += dt * 2.20;
    this.bp2      += dt * 1.55;
    this.bp3      += dt * 3.00;
    this.finPhase += dt * 2.8;

    // pick a new random wander direction periodically
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      const a         = Math.random() * Math.PI * 2;
      this.wanderVx    = Math.cos(a) * this.speed;
      this.wanderVy    = Math.sin(a) * this.speed;
      this.wanderTimer = Phaser.Math.FloatBetween(2.5, 5.5);
    }

    let tvx = this.wanderVx;
    let tvy = this.wanderVy;

    // notice nearest target only within a short radius
    const aggroRange = this.isBig ? 210 : 150;
    if (targetX !== undefined && targetY !== undefined) {
      const dist = Math.hypot(targetX - this.x, targetY - this.y);
      if (dist < aggroRange) {
        const d = dist || 1;
        tvx = ((targetX - this.x) / d) * this.speed;
        tvy = ((targetY - this.y) / d) * this.speed;
      }
    }

    // very slow turning — big enemies lumbering, normals sluggish
    const turn = this.isBig ? 0.38 : 0.75;
    this.vx = Phaser.Math.Linear(this.vx, tvx, Math.min(1, turn * dt));
    this.vy = Phaser.Math.Linear(this.vy, tvy, Math.min(1, turn * dt));

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // soft wall bounce: reflect velocity and wander target together
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
    const r   = this.radius;
    const dir = Math.atan2(this.vy, this.vx);
    const p   = this.palette;
    const { bp1: p1, bp2: p2, bp3: p3 } = this;

    // area-conserving dynamic deformation:
    // stretch along movement direction, compress perpendicular; pulse when idle
    const spd     = Math.hypot(this.vx, this.vy);
    const sf      = Math.min(1, spd / (this.speed * 1.1));
    const pulse   = 1 + 0.09 * Math.sin(this.finPhase * 0.38);
    const stretch = (1 + 0.28 * sf) * pulse;
    const rx  = r * this.rxFactor * stretch;
    const ry  = r * this.ryFactor / stretch;
    const cosD = Math.cos(dir);
    const sinD = Math.sin(dir);

    // big enemies get a menacing outer ring
    if (this.isBig) {
      gfx.lineStyle(3, p.membrane, 0.35);
      gfx.strokeCircle(this.x, this.y, r * 1.22);
    }

    drawFlagellum(gfx, this.x, this.y, r, dir, this.finPhase, p.membrane);

    const bodyAlpha  = this.isBig ? 0.70 : 0.52;
    const innerAlpha = this.isBig ? 0.28 : 0.20;

    gfx.fillStyle(p.body, this.isBig ? 0.14 : 0.10);
    fillBlob(gfx, this.x, this.y, rx * 1.40, ry * 1.40, p1, p2, p3, 28, dir);

    gfx.fillStyle(p.body, bodyAlpha);
    fillBlob(gfx, this.x, this.y, rx, ry, p1, p2, p3, 28, dir);

    gfx.fillStyle(p.body, innerAlpha);
    fillBlob(gfx, this.x, this.y, rx * 0.70, ry * 0.70, p1 + 0.5, p2 + 0.4, p3 - 0.3, 28, dir);

    for (const v of this.vacuoles) {
      const vx = this.x + (v.ox * cosD - v.oy * sinD) * r * 0.72;
      const vy = this.y + (v.ox * sinD + v.oy * cosD) * r * 0.72;
      const vr = v.vr * r;
      gfx.fillStyle(p.nucleus, 0.20);
      gfx.fillCircle(vx, vy, vr);
      gfx.lineStyle(0.5, p.membrane, 0.24);
      gfx.strokeCircle(vx, vy, vr);
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

    if (this.hp < this.maxHp - 0.5) {
      const bw = r * 1.7, bh = this.isBig ? 7 : 5;
      const bx = this.x - bw / 2, by = this.y - r - 15;
      gfx.fillStyle(0x000000, 0.50);
      gfx.fillRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 2);
      gfx.fillStyle(0x1a1010, 1);
      gfx.fillRoundedRect(bx, by, bw, bh, 2);
      gfx.fillStyle(this.isBig ? 0xd84040 : 0x38a868, 1);
      gfx.fillRoundedRect(bx, by, bw * (this.hp / this.maxHp), bh, 2);
    }

    const eyeR = r * (this.isBig ? 0.20 : 0.22);
    const ex = this.x + Math.cos(dir) * r * 0.38;
    const ey = this.y + Math.sin(dir) * r * 0.38;
    drawBioEye(gfx, ex, ey, eyeR, p.nucleus, dir);

    drawMandibles(gfx, this.x, this.y, r, dir, p.body, p.membrane, this.isBiting);
  }
}
