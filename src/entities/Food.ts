import Phaser from 'phaser';
import { fillBlob, strokeBlob } from './cellHelpers';

export type FoodType = 'green' | 'red';

export class Food {
  scene: Phaser.Scene;
  x: number; y: number;
  radius: number;
  type: FoodType;
  vx: number; vy: number;
  w: number;  // blob phase
  alive: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, type: FoodType, radius = 10) {
    this.scene  = scene;
    this.x = x; this.y = y;
    this.radius = radius;
    this.type   = type;
    this.vx = Phaser.Math.FloatBetween(-20, 20);
    this.vy = Phaser.Math.FloatBetween(-20, 20);
    this.w  = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.alive = true;
  }

  update(delta: number, width: number, height: number) {
    const dt = delta / 1000;
    this.w += dt * 1.4;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < this.radius || this.x > width  - this.radius) this.vx *= -1;
    if (this.y < this.radius || this.y > height - this.radius) this.vy *= -1;
    this.x = Phaser.Math.Clamp(this.x, this.radius, width  - this.radius);
    this.y = Phaser.Math.Clamp(this.y, this.radius, height - this.radius);
  }

  draw(gfx: Phaser.GameObjects.Graphics) {
    const r     = this.radius;
    const isGrn = this.type === 'green';
    const body  = isGrn ? 0x3a8a50 : 0x8a3030;
    const light = isGrn ? 0x78d498 : 0xd47878;
    const core  = isGrn ? 0x1a5030 : 0x5a1818;
    const p1 = this.w, p2 = this.w * 1.3 + 1, p3 = this.w * 0.8 - 0.5;
    const rx = r, ry = r * 0.90;

    // outer glow
    gfx.fillStyle(body, 0.07);
    fillBlob(gfx, this.x, this.y, rx * 1.6, ry * 1.6, p1, p2, p3);

    // translucent body
    gfx.fillStyle(body, 0.52);
    fillBlob(gfx, this.x, this.y, rx, ry, p1, p2, p3);

    // membrane ring
    gfx.lineStyle(0.9, light, 0.55);
    strokeBlob(gfx, this.x, this.y, rx, ry, p1, p2, p3);

    // content (nutrient core)
    gfx.fillStyle(core, 0.62);
    gfx.fillCircle(this.x, this.y, r * 0.34);
  }
}
