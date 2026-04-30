import Phaser from 'phaser';
import { CONFIG, WORLD_W, WORLD_H } from '../config/game.config';
import { Food } from '../entities/Food';
import type { FoodType } from '../entities/Food';
import { EnemyCell } from '../entities/EnemyCell';
import { AllyCell }  from '../entities/AllyCell';
import { fillBlob, strokeBlob, drawFlagellum, drawBioEye, drawMandibles } from '../entities/cellHelpers';

const P_BODY     = 0x50b882;
const P_MEMBRANE = 0x7ad8a8;
const P_NUCLEUS  = 0x1a6040;

const PLAYER_RADIUS_MAX = 160;
const BITE_DPS          = 10;
const ALLY_BITE_DPS     = 8;
const ENEMY_BITE_CD     = 1800;
const BIG_ENEMY_BITE_CD = 2800;
const HP_REGEN          = 3;

interface Bubble { x: number; y: number; r: number; speed: number; alpha: number; }
interface Snow   { x: number; y: number; vy: number; vx: number; r: number; alpha: number; }
interface Weed   { x: number; phase: number; height: number; segments: number; color: number; swayAmp: number; thickness: number; }

export class GameScene extends Phaser.Scene {
  private gfx!:    Phaser.GameObjects.Graphics;
  private gfxHUD!: Phaser.GameObjects.Graphics;
  private foods:   Food[]      = [];
  private enemies: EnemyCell[] = [];
  private allies:  AllyCell[]  = [];
  private bubbles: Bubble[]    = [];
  private snow:    Snow[]      = [];
  private weeds:   Weed[]      = [];

  private px = WORLD_W / 2;
  private py = WORLD_H / 2;
  private pvx = 0; private pvy = 0;
  private pDir = 0;
  private pRadius = CONFIG.player.radius;

  private pRxF = 1.0; private pRyF = 0.95;
  private pBp1 = 0.0; private pBp2 = 1.2; private pBp3 = 2.5;
  private pNox = 0.22; private pNoy = -0.18;
  private pVac = [
    { ox:  0.38, oy:  0.25, vr: 0.08 },
    { ox: -0.30, oy:  0.35, vr: 0.07 },
    { ox:  0.10, oy: -0.32, vr: 0.09 },
  ];
  private pFinPhase = 0;

  private pHp    = CONFIG.player.maxHp;
  private pMaxHp = CONFIG.player.maxHp;

  private score      = 0;
  private invincible = 0;
  private pBiting    = false;
  private enemyBiteCD: Map<EnemyCell, number> = new Map();

  private foodTimer     = 0;
  private enemyTimer    = 0;
  private bigEnemyTimer = 0;

  private pointer: Phaser.Input.Pointer | null = null;
  private pCursorX = WORLD_W / 2;
  private pCursorY = WORLD_H / 2;

  private scoreText!: Phaser.GameObjects.Text;
  private sizeText!:  Phaser.GameObjects.Text;

  private eatParticles: { x: number; y: number; vx: number; vy: number; life: number; color: number }[] = [];

  constructor() { super('GameScene'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.gfx    = this.add.graphics();
    this.gfxHUD = this.add.graphics().setScrollFactor(0).setDepth(5);

    this.px = WORLD_W / 2; this.py = WORLD_H / 2;
    this.pRadius   = CONFIG.player.radius;
    this.pRxF      = Phaser.Math.FloatBetween(0.92, 1.08);
    this.pRyF      = Phaser.Math.FloatBetween(0.92, 1.08);
    this.pBp1      = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.pBp2      = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.pBp3      = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.pNox      = Phaser.Math.FloatBetween(-0.35, 0.35);
    this.pNoy      = Phaser.Math.FloatBetween(-0.35, 0.35);
    this.pHp       = CONFIG.player.maxHp;
    this.pMaxHp    = CONFIG.player.maxHp;
    this.score     = 0; this.invincible = 0; this.pDir = 0;
    this.foods = []; this.enemies = []; this.allies = []; this.weeds = [];
    this.eatParticles = []; this.enemyBiteCD = new Map();
    this.foodTimer = 0; this.enemyTimer = 0; this.bigEnemyTimer = 0;

    this.scoreText = this.add.text(16, 18, 'Очки: 0', {
      fontSize: '20px', color: '#a8d8c0', fontFamily: 'monospace',
    }).setDepth(10).setScrollFactor(0);
    this.sizeText = this.add.text(16, 44, '', {
      fontSize: '14px', color: '#6abf98', fontFamily: 'monospace',
    }).setDepth(10).setScrollFactor(0);

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);

    this.initSnow(W, H);
    this.initWeeds();
    this.spawnInitialFood();
    this.spawnInitialBubbles(W, H);
    this.spawnInitialAllies();

    this.pCursorX = WORLD_W / 2; this.pCursorY = WORLD_H / 2;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointer  = p;
      this.pCursorX = p.worldX; this.pCursorY = p.worldY;
    });
    this.input.on('pointerup', () => { this.pointer = null; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.pCursorX = p.worldX; this.pCursorY = p.worldY;
      if (this.pointer) this.pointer = p;
    });
  }

  update(_time: number, delta: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    this.foodTimer     += delta;
    this.enemyTimer    += delta;
    this.bigEnemyTimer += delta;
    if (this.invincible > 0) this.invincible -= delta;

    this.pHp = Math.min(this.pMaxHp, this.pHp + HP_REGEN * delta / 1000);

    this.updatePlayer(delta);
    this.updateCamera(delta, W, H);
    this.updateFood(delta);
    this.updateEnemies(delta);
    this.updateAllies(delta);
    this.updateBubbles(delta, W, H);
    this.updateSnow(delta, W, H);
    this.checkCollisions(delta);
    this.render(W, H);
  }

  // ── Camera ──────────────────────────────────────────────────────────────────

  private updateCamera(delta: number, W: number, H: number) {
    const dt  = delta / 1000;
    const cam = this.cameras.main;
    const targetX = Phaser.Math.Clamp(this.px - W / 2, 0, WORLD_W - W);
    const targetY = Phaser.Math.Clamp(this.py - H / 2, 0, WORLD_H - H);
    cam.scrollX = Phaser.Math.Linear(cam.scrollX, targetX, Math.min(1, 6 * dt));
    cam.scrollY = Phaser.Math.Linear(cam.scrollY, targetY, Math.min(1, 6 * dt));
  }

  // ── Player ──────────────────────────────────────────────────────────────────

  private updatePlayer(delta: number) {
    const dt = delta / 1000;
    this.pBp1      += dt * 2.20;
    this.pBp2      += dt * 1.55;
    this.pBp3      += dt * 3.00;
    this.pFinPhase += dt * 2.6;

    if (this.pointer && this.pointer.isDown) {
      const dx = this.pCursorX - this.px;
      const dy = this.pCursorY - this.py;
      const d  = Math.hypot(dx, dy);
      if (d > 4) {
        const spd = CONFIG.player.speed * (CONFIG.player.radius / this.pRadius);
        this.pvx = Phaser.Math.Linear(this.pvx, (dx / d) * spd, 0.12);
        this.pvy = Phaser.Math.Linear(this.pvy, (dy / d) * spd, 0.12);
      }
    } else {
      this.pvx *= 0.92; this.pvy *= 0.92;
    }

    this.px += this.pvx * dt;
    this.py += this.pvy * dt;
    this.px = Phaser.Math.Clamp(this.px, this.pRadius, WORLD_W - this.pRadius);
    this.py = Phaser.Math.Clamp(this.py, this.pRadius, WORLD_H - this.pRadius);

    const targetDir = Math.atan2(this.pCursorY - this.py, this.pCursorX - this.px);
    const dAngle    = Phaser.Math.Angle.Wrap(targetDir - this.pDir);
    this.pDir       = Phaser.Math.Angle.Wrap(this.pDir + dAngle * Math.min(1, 7 * dt));
  }

  private growPlayer(amount: number) {
    this.pRadius = Math.min(PLAYER_RADIUS_MAX, this.pRadius + amount);
  }

  // ── Food ────────────────────────────────────────────────────────────────────

  private spawnInitialFood() {
    for (let i = 0; i < CONFIG.food.count; i++) this.spawnFood();
  }

  private spawnFood() {
    const m = 40;
    const x = Phaser.Math.Between(m, WORLD_W - m);
    const y = Phaser.Math.Between(m, WORLD_H - 110);
    const type: FoodType = Math.random() < 0.6 ? 'green' : 'red';
    this.foods.push(new Food(this, x, y, type, CONFIG.food.radius));
  }

  private updateFood(delta: number) {
    if (this.foodTimer > CONFIG.food.spawnInterval && this.foods.length < CONFIG.food.count) {
      this.spawnFood(); this.foodTimer = 0;
    }
    for (const f of this.foods) f.update(delta, WORLD_W, WORLD_H);
    this.foods = this.foods.filter(f => f.alive);
  }

  // ── Allies ───────────────────────────────────────────────────────────────────

  private spawnInitialAllies() {
    for (let i = 0; i < CONFIG.ally.count; i++) {
      const x = Phaser.Math.Between(WORLD_W / 2 - 220, WORLD_W / 2 + 220);
      const y = Phaser.Math.Between(WORLD_H / 2 - 220, WORLD_H / 2 + 220);
      this.allies.push(new AllyCell(this, x, y, CONFIG.ally.radius, CONFIG.ally.speed));
    }
  }

  private updateAllies(delta: number) {
    for (const a of this.allies) {
      a.updateAI(delta, WORLD_W, WORLD_H, this.px, this.py, this.enemies, this.pBiting);
    }
    for (const a of this.allies) {
      for (const f of this.foods) {
        if (!f.alive) continue;
        if (Math.hypot(a.x - f.x, a.y - f.y) < a.radius + f.radius) {
          f.alive = false;
          a.eatFood(f.radius);
          this.spawnEatParticles(f.x, f.y, 0x38d8b8);
        }
      }
    }
    this.allies = this.allies.filter(a => a.alive);
  }

  // ── Bubbles & Snow ──────────────────────────────────────────────────────────

  private spawnInitialBubbles(W: number, H: number) {
    for (let i = 0; i < CONFIG.bubble.count; i++) this.bubbles.push(this.makeBubble(W, H, true));
  }

  private makeBubble(W: number, H: number, rnd = false): Bubble {
    return {
      x: Phaser.Math.Between(0, W),
      y: rnd ? Phaser.Math.Between(0, H) : H + 10,
      r:     Phaser.Math.FloatBetween(2, 8),
      speed: Phaser.Math.FloatBetween(12, 35),
      alpha: Phaser.Math.FloatBetween(0.06, 0.26),
    };
  }

  private updateBubbles(delta: number, W: number, H: number) {
    const dt = delta / 1000;
    for (const b of this.bubbles) {
      b.y -= b.speed * dt;
      if (b.y < -20) Object.assign(b, this.makeBubble(W, H, false));
    }
  }

  private initSnow(W: number, H: number) {
    this.snow = Array.from({ length: 55 }, () => ({
      x: Phaser.Math.Between(0, W), y: Phaser.Math.Between(0, H),
      vy: Phaser.Math.FloatBetween(3, 9), vx: Phaser.Math.FloatBetween(-1.2, 1.2),
      r:  Phaser.Math.FloatBetween(0.5, 2.0), alpha: Phaser.Math.FloatBetween(0.05, 0.20),
    }));
  }

  private updateSnow(delta: number, W: number, H: number) {
    const dt = delta / 1000;
    for (const s of this.snow) {
      s.y += s.vy * dt; s.x += s.vx * dt;
      if (s.y > H + 5) { s.y = -5; s.x = Phaser.Math.Between(0, W); }
      if (s.x < 0) s.x = W;
      if (s.x > W) s.x = 0;
    }
  }

  // ── Seaweed ──────────────────────────────────────────────────────────────────

  private initWeeds() {
    const count = Math.floor(WORLD_W / 42);
    for (let i = 0; i < count; i++) {
      const h   = Phaser.Math.FloatBetween(35, 130);
      const rng = Math.random();
      this.weeds.push({
        x:         Phaser.Math.FloatBetween(10, WORLD_W - 10),
        phase:     Phaser.Math.FloatBetween(0, Math.PI * 2),
        height:    h,
        segments:  Math.max(3, Math.floor(h / 11)),
        color:     rng < 0.40 ? 0x2a8040 : rng < 0.70 ? 0x1a5828 : 0x3d7020,
        swayAmp:   h * 0.16,
        thickness: Phaser.Math.FloatBetween(1.2, 2.8),
      });
    }
  }

  // ── Enemies ─────────────────────────────────────────────────────────────────

  private spawnEnemy(big = false) {
    const side = Phaser.Math.Between(0, 3);
    const r    = big ? CONFIG.bigEnemy.radius : CONFIG.enemy.radius;
    let x = 0, y = 0;
    if      (side === 0) { x = Phaser.Math.Between(r, WORLD_W - r); y = r; }
    else if (side === 1) { x = WORLD_W - r; y = Phaser.Math.Between(r, WORLD_H - r); }
    else if (side === 2) { x = Phaser.Math.Between(r, WORLD_W - r); y = WORLD_H - r; }
    else                 { x = r;           y = Phaser.Math.Between(r, WORLD_H - r); }
    const spd = big ? CONFIG.bigEnemy.speed : CONFIG.enemy.speed;
    this.enemies.push(new EnemyCell(this, x, y, spd, r, big));
  }

  private updateEnemies(delta: number) {
    if (this.enemyTimer > CONFIG.enemy.spawnInterval) {
      const normalCount = this.enemies.filter(e => !e.isBig).length;
      if (normalCount < CONFIG.enemy.count) this.spawnEnemy(false);
      this.enemyTimer = 0;
    }
    if (this.bigEnemyTimer > CONFIG.bigEnemy.spawnInterval) {
      const bigCount = this.enemies.filter(e => e.isBig).length;
      if (bigCount < CONFIG.bigEnemy.count) this.spawnEnemy(true);
      this.bigEnemyTimer = 0;
    }

    for (const e of this.enemies) {
      e.isBiting = false;
      let nearX = this.px, nearY = this.py;
      let nearDist = Math.hypot(this.px - e.x, this.py - e.y);
      for (const a of this.allies) {
        if (!a.alive) continue;
        const ad = Math.hypot(a.x - e.x, a.y - e.y);
        if (ad < nearDist) { nearDist = ad; nearX = a.x; nearY = a.y; }
      }
      e.update(delta, WORLD_W, WORLD_H, nearX, nearY);
    }

    for (const e of this.enemies) {
      if (e.isBig) continue;
      for (const f of this.foods) {
        if (!f.alive) continue;
        if (Math.hypot(e.x - f.x, e.y - f.y) < e.radius + f.radius) {
          f.alive = false; e.eatFood(f.radius);
          this.spawnEatParticles(f.x, f.y, e.color);
        }
      }
    }

    this.enemies = this.enemies.filter(e => e.alive);
  }

  // ── Collisions ───────────────────────────────────────────────────────────────

  private checkCollisions(delta: number) {
    const dt = delta / 1000;

    for (const f of this.foods) {
      if (!f.alive) continue;
      if (Math.hypot(this.px - f.x, this.py - f.y) < this.pRadius + f.radius - 4) {
        f.alive = false;
        const isGreen = f.type === 'green';
        this.score += isGreen ? 10 : 5;
        this.growPlayer(isGreen ? 4 : 2);
        this.pHp = Math.min(this.pMaxHp, this.pHp + (isGreen ? 20 : 10));
        this.scoreText.setText(`Очки: ${this.score}`);
        this.sizeText.setText(`Размер: ${Math.round(this.pRadius)}`);
        this.spawnEatParticles(f.x, f.y, isGreen ? 0x38a868 : 0xa83838);
      }
    }

    this.pBiting = false;
    for (const e of this.enemies) {
      const dist = Math.hypot(this.px - e.x, this.py - e.y);
      if (dist >= this.pRadius + e.radius) continue;

      if (this.pRadius >= e.radius * 0.70) {
        this.pBiting = true;
        const sizeBonus = Math.sqrt(this.pRadius / CONFIG.player.radius);
        e.takeDamage(BITE_DPS * dt * (this.pRadius / e.radius) * sizeBonus);
        if (!e.alive) {
          this.score += Math.round(e.maxHp * (e.isBig ? 8 : 3));
          this.growPlayer(e.maxRadius * (e.isBig ? 0.25 : 0.15));
          this.pHp = Math.min(this.pMaxHp, this.pHp + (e.isBig ? 30 : 10));
          this.scoreText.setText(`Очки: ${this.score}`);
          this.sizeText.setText(`Размер: ${Math.round(this.pRadius)}`);
          this.spawnEatParticles(e.x, e.y, e.color);
          this.spawnEatParticles(e.x, e.y, 0xfff8e8);
          this.enemyBiteCD.delete(e);
          continue;
        }
      }

      if (e.alive && this.invincible <= 0) {
        const spd = Math.hypot(e.vx, e.vy);
        const efx = spd > 0.1 ? e.vx / spd : 1;
        const efy = spd > 0.1 ? e.vy / spd : 0;
        const dot = ((this.px - e.x) * efx + (this.py - e.y) * efy) / (dist || 1);
        if (dot > 0.28) {
          const cd = this.enemyBiteCD.get(e) ?? 0;
          if (cd <= 0) {
            e.isBiting = true;
            const dmg = e.isBig ? 28 : 10;
            this.pHp -= dmg;
            this.invincible = e.isBig ? 600 : 1200;
            this.enemyBiteCD.set(e, e.isBig ? BIG_ENEMY_BITE_CD : ENEMY_BITE_CD);
            this.cameras.main.shake(e.isBig ? 350 : 200, e.isBig ? 0.022 : 0.013);
            if (this.pHp <= 0) {
              this.pHp = 0;
              this.time.delayedCall(500, () => this.scene.start('GameOverScene', { score: this.score }));
            }
          }
        }
      }
    }

    for (const a of this.allies) {
      if (!a.isBiting) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(a.x - e.x, a.y - e.y);
        if (d < a.radius + e.radius + 6) {
          const coopMult = a.cooperating ? 1.4 : 1.0;
          e.takeDamage(ALLY_BITE_DPS * dt * (a.radius / e.radius) * coopMult);
          if (!e.alive) {
            this.score += Math.round(e.maxHp * (e.isBig ? 6 : 2));
            this.scoreText.setText(`Очки: ${this.score}`);
            this.spawnEatParticles(e.x, e.y, e.color);
            this.enemyBiteCD.delete(e);
          }
        }
      }
    }

    for (const e of this.enemies) {
      if (!e.isBig) continue;
      for (const a of this.allies) {
        if (!a.alive) continue;
        const d = Math.hypot(e.x - a.x, e.y - a.y);
        if (d < e.radius + a.radius) {
          const spd = Math.hypot(e.vx, e.vy);
          const efx = spd > 0.1 ? e.vx / spd : 1;
          const efy = spd > 0.1 ? e.vy / spd : 0;
          const dot = ((a.x - e.x) * efx + (a.y - e.y) * efy) / (d || 1);
          if (dot > 0.28) {
            const cd = this.enemyBiteCD.get(e) ?? 0;
            if (cd <= 0) {
              a.takeDamage(95);
              this.spawnEatParticles(a.x, a.y, 0x38d8b8);
              this.enemyBiteCD.set(e, BIG_ENEMY_BITE_CD);
            }
          }
        }
      }
    }

    for (const [e, cd] of this.enemyBiteCD) this.enemyBiteCD.set(e, cd - delta);
  }

  // ── Particles ────────────────────────────────────────────────────────────────

  private spawnEatParticles(x: number, y: number, color: number) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.eatParticles.push({
        x, y,
        vx: Math.cos(a) * Phaser.Math.FloatBetween(30, 90),
        vy: Math.sin(a) * Phaser.Math.FloatBetween(30, 90),
        life: 1, color,
      });
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  private render(W: number, H: number) {
    const g   = this.gfx;
    const hud = this.gfxHUD;
    g.clear();
    hud.clear();

    const cam = this.cameras.main;
    const cx  = cam.scrollX;
    const cy  = cam.scrollY;

    this.drawOcean(g, W, H, cx, cy);
    this.drawSurface(g, W, cx, cy);
    this.drawSeafloor(g, W, H, cx, cy);
    this.drawWeeds(g, W, H, cx, cy);
    this.drawSnow(g, cx, cy);
    this.drawBubbles(g, cx, cy);
    for (const f of this.foods)   f.draw(g);
    for (const a of this.allies)  a.draw(g);
    for (const e of this.enemies) e.draw(g);
    this.drawEatParticles(g);
    this.drawPlayer(g);
    this.drawHUD(hud, W);
  }

  // ── Ocean ───────────────────────────────────────────────────────────────────

  private drawOcean(g: Phaser.GameObjects.Graphics, W: number, H: number, cx: number, cy: number) {
    g.fillStyle(0x0d3a6a, 1);    g.fillRect(cx, cy,            W, H);
    g.fillStyle(0x2a88c8, 0.55); g.fillRect(cx, cy,            W, H * 0.18);
    g.fillStyle(0x1a60a0, 0.42); g.fillRect(cx, cy,            W, H * 0.42);
    g.fillStyle(0x082848, 0.28); g.fillRect(cx, cy + H * 0.58, W, H * 0.42);
    g.fillStyle(0x041828, 0.32); g.fillRect(cx, cy + H * 0.82, W, H * 0.18);

    const t = this.time.now / 1000;
    this.drawGodRays(g, W, H, t, cx, cy);

    const wt = t / 1.8;
    for (let i = 0; i < 7; i++) {
      const baseY = cy + H * (0.06 + i * 0.135);
      const amp   = (10 + 6 * Math.sin(i * 1.8)) * (H / 800);
      const spd   = 0.55 + i * 0.10;
      const phase = i * 1.05;
      const thick = (22 + 10 * Math.abs(Math.sin(i * 2.3))) * (H / 800);
      const alpha = 0.055 + 0.025 * Math.abs(Math.sin(i * 0.9 + wt * 0.3));
      g.fillStyle(0x5ab8e8, alpha);
      g.beginPath();
      for (let xi = 0; xi <= W + 12; xi += 10) {
        const y = baseY + amp * Math.sin((xi / W) * Math.PI * 3.5 + wt * spd + phase);
        xi === 0 ? g.moveTo(cx + xi, y) : g.lineTo(cx + xi, y);
      }
      for (let xi = W; xi >= 0; xi -= 10) {
        const y = baseY + thick + amp * Math.sin((xi / W) * Math.PI * 3.5 + wt * spd + phase + 0.35);
        g.lineTo(cx + xi, y);
      }
      g.closePath(); g.fillPath();
    }

    this.drawCaustics(g, W, H, t, cx, cy);

    g.fillStyle(0x000000, 0.10); g.fillRect(cx,            cy, W * 0.05, H);
    g.fillStyle(0x000000, 0.10); g.fillRect(cx + W * 0.95, cy, W * 0.05, H);
    g.fillStyle(0x1a2830, 0.60); g.fillRect(cx, cy + H * 0.93, W, H * 0.07);
    g.fillStyle(0x283840, 0.35); g.fillRect(cx, cy + H * 0.91, W, H * 0.04);
  }

  private drawGodRays(g: Phaser.GameObjects.Graphics, W: number, H: number, t: number, cx: number, cy: number) {
    const clusters = [
      { x: 0.07, ph: 0.00, spd: 0.15, al: 0.038 },
      { x: 0.17, ph: 1.28, spd: 0.20, al: 0.028 },
      { x: 0.29, ph: 2.55, spd: 0.13, al: 0.042 },
      { x: 0.40, ph: 0.82, spd: 0.18, al: 0.030 },
      { x: 0.51, ph: 3.18, spd: 0.16, al: 0.038 },
      { x: 0.62, ph: 1.73, spd: 0.21, al: 0.028 },
      { x: 0.74, ph: 0.48, spd: 0.14, al: 0.040 },
      { x: 0.85, ph: 2.65, spd: 0.19, al: 0.030 },
      { x: 0.94, ph: 1.05, spd: 0.17, al: 0.035 },
    ];

    const LINES = 18;
    for (const c of clusters) {
      const sway  = Math.sin(t * c.spd + c.ph) * W * 0.018;
      const cxc   = cx + W * c.x + sway;
      const baseAl = c.al * (0.85 + 0.15 * Math.abs(Math.sin(t * 0.22 + c.ph)));

      for (let li = 0; li < LINES; li++) {
        const frac   = (li / (LINES - 1)) - 0.5;
        const gauss  = Math.exp(-frac * frac * 9);
        const lineAl = baseAl * gauss;
        if (lineAl < 0.006) continue;

        const topOff = frac * W * 0.008;
        const botOff = frac * W * 0.040 + sway * 0.55;
        const depth  = H * (0.52 + Math.sin(c.ph + li * 0.21) * 0.10);
        const midX   = cxc + (topOff + botOff) * 0.5 + Math.sin(t * 1.25 + c.ph + li * 0.70) * 5;
        const midY   = cy + depth * 0.48;

        g.lineStyle(1.3, 0xb8dcff, lineAl);
        g.beginPath(); g.moveTo(cxc + topOff, cy); g.lineTo(midX, midY); g.strokePath();

        g.lineStyle(1.3, 0xb8dcff, lineAl * 0.25);
        g.beginPath(); g.moveTo(midX, midY); g.lineTo(cxc + botOff, cy + depth); g.strokePath();
      }
    }
  }

  private drawCaustics(g: Phaser.GameObjects.Graphics, W: number, H: number, t: number, cx: number, cy: number) {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 5; col++) {
        const i   = row * 5 + col;
        const px2 = cx + W * ((col + 0.5) / 5) + Math.sin(t * 0.55 + i * 1.1) * W * 0.040;
        const py2 = cy + H * (0.04 + row * 0.22) + Math.cos(t * 0.42 + i * 0.85) * H * 0.022;
        const cr  = (26 + 13 * Math.abs(Math.sin(t * 0.95 + i * 0.65))) * (H / 800);
        const al  = 0.044 + 0.024 * Math.abs(Math.sin(t * 0.78 + i));
        const tc  = t * 1.35 + i * 0.5;
        const N   = 8;

        g.fillStyle(0x70b8e8, al * 0.50);
        g.beginPath();
        for (let k = 0; k <= N; k++) {
          const a = (k / N) * Math.PI * 2;
          const d = 1 + 0.30 * Math.sin(a * 3 + tc) + 0.16 * Math.cos(a * 2 + tc * 0.65);
          k === 0
            ? g.moveTo(px2 + Math.cos(a) * cr * 1.5 * d, py2 + Math.sin(a) * cr * 1.5 * d)
            : g.lineTo(px2 + Math.cos(a) * cr * 1.5 * d, py2 + Math.sin(a) * cr * 1.5 * d);
        }
        g.closePath(); g.fillPath();

        g.fillStyle(0x90cef8, al);
        g.beginPath();
        for (let k = 0; k <= N; k++) {
          const a = (k / N) * Math.PI * 2;
          const d = 1 + 0.30 * Math.sin(a * 3 + tc) + 0.16 * Math.cos(a * 2 + tc * 0.65);
          k === 0
            ? g.moveTo(px2 + Math.cos(a) * cr * d, py2 + Math.sin(a) * cr * d)
            : g.lineTo(px2 + Math.cos(a) * cr * d, py2 + Math.sin(a) * cr * d);
        }
        g.closePath(); g.fillPath();
      }
    }
  }

  // ── Surface (top of world — bright shore band) ───────────────────────────────

  private drawSurface(g: Phaser.GameObjects.Graphics, W: number, cx: number, cy: number) {
    if (cy > 180) return;

    const t = this.time.now / 1000;

    g.fillStyle(0x80e8ff, 0.42); g.fillRect(cx, 0, W, 70);
    g.fillStyle(0xc0f8ff, 0.24); g.fillRect(cx, 0, W, 30);
    g.fillStyle(0xffffff, 0.09); g.fillRect(cx, 0, W, 12);

    for (let wi = 0; wi < 4; wi++) {
      const baseWY = wi * 16;
      g.fillStyle(0xa8ecff, 0.13 - wi * 0.025);
      g.beginPath();
      for (let xi = 0; xi <= W; xi += 12) {
        const y = baseWY + 7 * Math.sin((cx + xi) * 0.0055 + t * 1.1 + wi * 1.5);
        xi === 0 ? g.moveTo(cx + xi, y) : g.lineTo(cx + xi, y);
      }
      for (let xi = W; xi >= 0; xi -= 12) {
        const y = baseWY + 14 + 7 * Math.sin((cx + xi) * 0.0055 + t * 1.1 + wi * 1.5 + 0.45);
        g.lineTo(cx + xi, y);
      }
      g.closePath(); g.fillPath();
    }
  }

  // ── Seafloor ─────────────────────────────────────────────────────────────────

  private drawSeafloor(g: Phaser.GameObjects.Graphics, W: number, H: number, cx: number, cy: number) {
    const floorY = WORLD_H - 90;
    if (floorY > cy + H + 20 || floorY + 90 < cy - 20) return;

    const t = this.time.now / 1000;

    g.fillStyle(0x7a6040, 1);     g.fillRect(cx, floorY, W, 90);
    g.fillStyle(0xb08850, 0.50);  g.fillRect(cx, floorY, W, 16);
    g.fillStyle(0xd0a870, 0.28);  g.fillRect(cx, floorY, W, 7);

    for (let ri = 0; ri < 7; ri++) {
      const ry = floorY + 22 + ri * 9;
      g.lineStyle(1.0, 0x5a4020, 0.18);
      g.beginPath();
      for (let xi = 0; xi <= W; xi += 8) {
        const y = ry + 2.5 * Math.sin((cx + xi) * 0.012 + ri * 0.5 + t * 0.10);
        xi === 0 ? g.moveTo(cx + xi, y) : g.lineTo(cx + xi, y);
      }
      g.strokePath();
    }
  }

  // ── Weeds ────────────────────────────────────────────────────────────────────

  private drawWeeds(g: Phaser.GameObjects.Graphics, W: number, H: number, cx: number, cy: number) {
    const floorY = WORLD_H - 90;
    if (floorY - 140 > cy + H || floorY < cy - 20) return;

    const t    = this.time.now / 1000;
    const minX = cx - 60;
    const maxX = cx + W + 60;

    for (const weed of this.weeds) {
      if (weed.x < minX || weed.x > maxX) continue;

      const seg = weed.segments;
      g.lineStyle(weed.thickness, weed.color, 0.88);
      g.beginPath();
      g.moveTo(weed.x, floorY);

      for (let i = 1; i <= seg; i++) {
        const frac  = i / seg;
        const swayX = weed.swayAmp * Math.sin(t * 0.80 + weed.phase + frac * Math.PI * 2.5) * frac * 0.9;
        g.lineTo(weed.x + swayX, floorY - weed.height * frac);
      }
      g.strokePath();

      // tip leaf
      const tipSway = weed.swayAmp * Math.sin(t * 0.80 + weed.phase + Math.PI * 2.5) * 0.9;
      g.fillStyle(weed.color, 0.58);
      g.fillEllipse(weed.x + tipSway, floorY - weed.height, weed.thickness * 3.5, weed.thickness * 2.2);
    }
  }

  // ── Atmospheric ─────────────────────────────────────────────────────────────

  private drawSnow(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
    for (const s of this.snow) {
      g.fillStyle(0xc8dff8, s.alpha);
      g.fillCircle(cx + s.x, cy + s.y, s.r);
    }
  }

  private drawBubbles(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
    for (const b of this.bubbles) {
      const wx = cx + b.x, wy = cy + b.y;
      g.lineStyle(0.8, 0x9ad0e8, b.alpha * 0.85);
      g.strokeCircle(wx, wy, b.r);
      g.fillStyle(0xffffff, b.alpha * 0.30);
      g.fillCircle(wx - b.r * 0.28, wy - b.r * 0.28, b.r * 0.25);
    }
  }

  private drawEatParticles(g: Phaser.GameObjects.Graphics) {
    const dt = this.game.loop.delta / 1000;
    for (const p of this.eatParticles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 2.2;
      if (p.life > 0) {
        g.fillStyle(p.color, p.life * 0.80);
        g.fillCircle(p.x, p.y, 3.2 * p.life);
      }
    }
    this.eatParticles = this.eatParticles.filter(p => p.life > 0);
  }

  // ── HUD ──────────────────────────────────────────────────────────────────────

  private drawHUD(g: Phaser.GameObjects.Graphics, W: number) {
    const bw = 180, bh = 10;
    const bx = W - 16 - bw, by = 18;
    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 4);
    g.fillStyle(0x061810, 1);
    g.fillRoundedRect(bx, by, bw, bh, 3);
    const hf  = this.pHp / this.pMaxHp;
    const col = hf > 0.55 ? 0x44dd88 : hf > 0.28 ? 0xe0c030 : 0xe04030;
    g.fillStyle(col, 1);
    g.fillRoundedRect(bx, by, bw * hf, bh, 3);
    g.lineStyle(1, 0x60c8a0, 0.45);
    g.strokeRoundedRect(bx, by, bw, bh, 3);

    const aliveAllies = this.allies.filter(a => a.alive).length;
    for (let i = 0; i < CONFIG.ally.count; i++) {
      const ax = W - 16 - bw + i * 16;
      const ay = by + bh + 6;
      g.fillStyle(i < aliveAllies ? 0x44dd88 : 0x1a3020, 1);
      g.fillCircle(ax, ay, 5);
      g.lineStyle(1, 0x7ad8a8, 0.50);
      g.strokeCircle(ax, ay, 5);
    }
  }

  // ── Player ───────────────────────────────────────────────────────────────────

  private drawPlayer(g: Phaser.GameObjects.Graphics) {
    const r      = this.pRadius;
    const dir    = this.pDir;
    const flicker = this.invincible > 0 && Math.floor(this.invincible / 80) % 2 === 0;
    if (flicker) return;

    const p1 = this.pBp1, p2 = this.pBp2, p3 = this.pBp3;

    const spd     = Math.hypot(this.pvx, this.pvy);
    const sf      = Math.min(1, spd / (CONFIG.player.speed * 1.1));
    const pulse   = 1 + 0.09 * Math.sin(this.pFinPhase * 0.38);
    const stretch = (1 + 0.28 * sf) * pulse;
    const rx      = r * this.pRxF * stretch;
    const ry      = r * this.pRyF / stretch;
    const cosD    = Math.cos(dir);
    const sinD    = Math.sin(dir);

    drawFlagellum(g, this.px, this.py, r, dir, this.pFinPhase, P_MEMBRANE);

    g.fillStyle(P_BODY, 0.54);
    fillBlob(g, this.px, this.py, rx, ry, p1, p2, p3, 28, dir);

    g.fillStyle(P_BODY, 0.20);
    fillBlob(g, this.px, this.py, rx * 0.70, ry * 0.70, p1 + 0.5, p2 + 0.4, p3 - 0.3, 28, dir);

    for (const v of this.pVac) {
      const vx = this.px + (v.ox * cosD - v.oy * sinD) * r * 0.72;
      const vy = this.py + (v.ox * sinD + v.oy * cosD) * r * 0.72;
      g.fillStyle(P_NUCLEUS, 0.16);
      g.fillCircle(vx, vy, v.vr * r);
      g.lineStyle(0.5, P_MEMBRANE, 0.22);
      g.strokeCircle(vx, vy, v.vr * r);
    }

    const nr = r * 0.31;
    const nx = this.px + (this.pNox * cosD - this.pNoy * sinD) * r * 0.36;
    const ny = this.py + (this.pNox * sinD + this.pNoy * cosD) * r * 0.36;
    g.fillStyle(P_NUCLEUS, 0.66);
    fillBlob(g, nx, ny, nr, nr * 0.88, p1 * 0.6, p2 * 0.7, p3 * 0.5);
    g.lineStyle(0.8, P_MEMBRANE, 0.38);
    strokeBlob(g, nx, ny, nr, nr * 0.88, p1 * 0.6, p2 * 0.7, p3 * 0.5);

    g.lineStyle(Math.max(1.2, r * 0.045), P_MEMBRANE, 0.78);
    strokeBlob(g, this.px, this.py, rx, ry, p1, p2, p3, 28, dir);

    g.fillStyle(P_MEMBRANE, 0.09);
    g.fillEllipse(this.px - r * 0.18, this.py - r * 0.22, r * 0.50, r * 0.30);

    const eyeR   = r * 0.22;
    const eyeOff = r * 0.36;
    for (const side of [-1, 1]) {
      const ex = this.px + Math.cos(dir + side * 0.58) * eyeOff;
      const ey = this.py + Math.sin(dir + side * 0.58) * eyeOff;
      drawBioEye(g, ex, ey, eyeR, P_NUCLEUS, dir);
    }

    drawMandibles(g, this.px, this.py, r, dir, P_BODY, P_MEMBRANE, this.pBiting);
  }
}
