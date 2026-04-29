import Phaser from 'phaser';
import { fillBlob, strokeBlob, drawFlagellum, drawBioEye, drawMandibles } from './cellHelpers';
import type { EnemyCell } from './EnemyCell';

// same green palette as player
const BODY     = 0x50b882;
const MEMBRANE = 0x7ad8a8;
const NUCLEUS  = 0x1a6040;

export class AllyCell {
  scene: Phaser.Scene;
  x: number; y: number;
  vx = 0; vy = 0;
  radius: number; maxRadius: number;
  hp: number; maxHp: number;
  speed: number;
  rxFactor: number; ryFactor: number;
  bp1: number; bp2: number; bp3: number;
  nucleusOx: number; nucleusOy: number;
  vacuoles: { ox: number; oy: number; vr: number }[];
  finPhase: number;
  alive = true;
  isBiting = false;
  cooperating = false; // true when helping player attack same target

  constructor(scene: Phaser.Scene, x: number, y: number, radius: number, speed: number) {
    this.scene = scene;
    this.x = x; this.y = y;
    this.radius = radius; this.maxRadius = radius;
    this.hp = 160; this.maxHp = 160;
    this.speed = speed;
    this.rxFactor  = Phaser.Math.FloatBetween(0.90, 1.10);
    this.ryFactor  = Phaser.Math.FloatBetween(0.90, 1.10);
    this.bp1       = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.bp2       = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.bp3       = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.nucleusOx = Phaser.Math.FloatBetween(-0.35, 0.35);
    this.nucleusOy = Phaser.Math.FloatBetween(-0.35, 0.35);
    this.vacuoles  = Array.from({ length: Phaser.Math.Between(2, 3) }, () => ({
      ox: Phaser.Math.FloatBetween(-0.50, 0.50),
      oy: Phaser.Math.FloatBetween(-0.50, 0.50),
      vr: Phaser.Math.FloatBetween(0.06, 0.11),
    }));
    this.finPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    // start with a random drift
    const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.vx = Math.cos(a) * speed * 0.4;
    this.vy = Math.sin(a) * speed * 0.4;
  }

  takeDamage(amount: number) {
    this.hp -= amount;
    if (this.hp <= 0) this.alive = false;
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  eatFood(foodRadius: number) {
    const gain = foodRadius * 0.4;
    this.maxRadius = Math.min(this.maxRadius + gain * 0.5, 80);
    this.radius    = Math.min(this.radius    + gain * 0.3, 80);
    this.heal(8);
  }

  updateAI(
    delta: number, W: number, H: number,
    px: number, py: number,
    enemies: EnemyCell[],
    playerBiting: boolean,
  ) {
    const dt = delta / 1000;
    this.bp1      += dt * 2.20;
    this.bp2      += dt * 1.55;
    this.bp3      += dt * 3.00;
    this.finPhase += dt * 2.6;

    // passive HP regen
    this.hp = Math.min(this.maxHp, this.hp + 1.5 * dt);

    const distToPlayer = Math.hypot(px - this.x, py - this.y);

    // find nearest enemy (prefer enemies that player is also fighting)
    let target: EnemyCell | null = null;
    let bestScore = Infinity;
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      // prefer close enemies and enemies already under attack
      const score = d - (playerBiting && Math.hypot(e.x - px, e.y - py) < 200 ? 120 : 0);
      if (score < bestScore && d < 320) { bestScore = score; target = e; }
    }

    this.isBiting   = false;
    this.cooperating = false;

    if (target && distToPlayer < 500) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const d  = Math.hypot(dx, dy) || 1;
      this.vx = Phaser.Math.Linear(this.vx, (dx / d) * this.speed, 0.09);
      this.vy = Phaser.Math.Linear(this.vy, (dy / d) * this.speed, 0.09);
      if (d < this.radius + target.radius + 8) {
        this.isBiting    = true;
        this.cooperating = playerBiting && Math.hypot(target.x - px, target.y - py) < this.radius + target.radius + 20;
      }
    } else if (distToPlayer > 260) {
      // drift back toward player
      const dx = px - this.x;
      const dy = py - this.y;
      const d  = Math.hypot(dx, dy) || 1;
      this.vx = Phaser.Math.Linear(this.vx, (dx / d) * this.speed * 0.50, 0.06);
      this.vy = Phaser.Math.Linear(this.vy, (dy / d) * this.speed * 0.50, 0.06);
    } else {
      // gentle wander
      if (Math.random() < dt * 0.9) {
        const a = Math.random() * Math.PI * 2;
        this.vx += Math.cos(a) * 22;
        this.vy += Math.sin(a) * 22;
      }
      this.vx *= 0.96;
      this.vy *= 0.96;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const spd = Math.hypot(this.vx, this.vy);
    const maxSpd = this.speed * 1.1;
    if (spd > maxSpd) { this.vx *= maxSpd / spd; this.vy *= maxSpd / spd; }
    this.x = Phaser.Math.Clamp(this.x, this.radius, W - this.radius);
    this.y = Phaser.Math.Clamp(this.y, this.radius, H - this.radius);
  }

  draw(gfx: Phaser.GameObjects.Graphics) {
    const r   = this.radius;
    const dir = Math.atan2(this.vy, this.vx) || 0;
    const p1  = this.bp1, p2 = this.bp2, p3 = this.bp3;

    // area-conserving dynamic deformation
    const spd     = Math.hypot(this.vx, this.vy);
    const sf      = Math.min(1, spd / (this.speed * 1.1));
    const pulse   = 1 + 0.09 * Math.sin(this.finPhase * 0.38);
    const stretch = (1 + 0.28 * sf) * pulse;
    const rx  = r * this.rxFactor * stretch;
    const ry  = r * this.ryFactor / stretch;
    const cosD = Math.cos(dir);
    const sinD = Math.sin(dir);

    // cooperating glow ring
    if (this.cooperating) {
      gfx.lineStyle(3, MEMBRANE, 0.55);
      gfx.strokeCircle(this.x, this.y, r * 1.28);
    }

    drawFlagellum(gfx, this.x, this.y, r, dir, this.finPhase, MEMBRANE);

    gfx.fillStyle(BODY, 0.11);
    fillBlob(gfx, this.x, this.y, rx * 1.40, ry * 1.40, p1, p2, p3, 28, dir);

    gfx.fillStyle(BODY, 0.52);
    fillBlob(gfx, this.x, this.y, rx, ry, p1, p2, p3, 28, dir);

    gfx.fillStyle(BODY, 0.18);
    fillBlob(gfx, this.x, this.y, rx * 0.70, ry * 0.70, p1 + 0.5, p2 + 0.4, p3 - 0.3, 28, dir);

    for (const v of this.vacuoles) {
      const vx = this.x + (v.ox * cosD - v.oy * sinD) * r * 0.72;
      const vy = this.y + (v.ox * sinD + v.oy * cosD) * r * 0.72;
      const vr = v.vr * r;
      gfx.fillStyle(NUCLEUS, 0.18);
      gfx.fillCircle(vx, vy, vr);
      gfx.lineStyle(0.5, MEMBRANE, 0.22);
      gfx.strokeCircle(vx, vy, vr);
    }

    const nr  = r * 0.31;
    const nx  = this.x + (this.nucleusOx * cosD - this.nucleusOy * sinD) * r * 0.36;
    const ny  = this.y + (this.nucleusOx * sinD + this.nucleusOy * cosD) * r * 0.36;
    gfx.fillStyle(NUCLEUS, 0.68);
    fillBlob(gfx, nx, ny, nr, nr * 0.88, p1 * 0.6, p2 * 0.7, p3 * 0.5);
    gfx.lineStyle(0.8, MEMBRANE, 0.40);
    strokeBlob(gfx, nx, ny, nr, nr * 0.88, p1 * 0.6, p2 * 0.7, p3 * 0.5);

    gfx.lineStyle(Math.max(1.2, r * 0.045), MEMBRANE, 0.78);
    strokeBlob(gfx, this.x, this.y, rx, ry, p1, p2, p3, 28, dir);

    gfx.fillStyle(MEMBRANE, 0.10);
    gfx.fillEllipse(this.x - r * 0.18, this.y - r * 0.22, r * 0.50, r * 0.30);

    // hp bar (always visible for allies)
    const bw = r * 1.5, bh = 4;
    const bx = this.x - bw / 2, by = this.y - r - 12;
    gfx.fillStyle(0x000000, 0.40);
    gfx.fillRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 2);
    gfx.fillStyle(0x0a2820, 1);
    gfx.fillRoundedRect(bx, by, bw, bh, 2);
    const hf = this.hp / this.maxHp;
    gfx.fillStyle(hf > 0.5 ? 0x44dd88 : hf > 0.25 ? 0xe0c030 : 0xe04030, 1);
    gfx.fillRoundedRect(bx, by, bw * hf, bh, 2);

    const eyeR = r * 0.22;
    const ex   = this.x + Math.cos(dir) * r * 0.38;
    const ey   = this.y + Math.sin(dir) * r * 0.38;
    drawBioEye(gfx, ex, ey, eyeR, NUCLEUS, dir);

    drawMandibles(gfx, this.x, this.y, r, dir, BODY, MEMBRANE, this.isBiting);
  }
}
