import Phaser from 'phaser';
import { CONFIG, GAME_WIDTH, GAME_HEIGHT } from '../config/game.config';
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
const HP_REGEN          = 3;    // hp/sec passive

interface Bubble { x: number; y: number; r: number; speed: number; alpha: number; }
interface Snow   { x: number; y: number; vy: number; vx: number; r: number; alpha: number; }

export class GameScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private foods:   Food[]      = [];
  private enemies: EnemyCell[] = [];
  private allies:  AllyCell[]  = [];
  private bubbles: Bubble[]    = [];
  private snow:    Snow[]      = [];

  // player movement
  private px = GAME_WIDTH / 2;
  private py = GAME_HEIGHT / 2;
  private pvx = 0; private pvy = 0;
  private pDir = 0;
  private pRadius = CONFIG.player.radius;

  // player blob shape
  private pRxF = 1.0; private pRyF = 0.95;
  private pBp1 = 0.0; private pBp2 = 1.2; private pBp3 = 2.5;
  private pNox = 0.22; private pNoy = -0.18;
  private pVac = [
    { ox:  0.38, oy:  0.25, vr: 0.08 },
    { ox: -0.30, oy:  0.35, vr: 0.07 },
    { ox:  0.10, oy: -0.32, vr: 0.09 },
  ];
  private pFinPhase = 0;

  // player health
  private pHp    = CONFIG.player.maxHp;
  private pMaxHp = CONFIG.player.maxHp;

  // combat
  private score      = 0;
  private invincible = 0;
  private pBiting    = false;
  private enemyBiteCD: Map<EnemyCell, number> = new Map();

  // timers
  private foodTimer     = 0;
  private enemyTimer    = 0;
  private bigEnemyTimer = 0;

  // input
  private pointer: Phaser.Input.Pointer | null = null;
  private pCursorX = GAME_WIDTH / 2;
  private pCursorY = GAME_HEIGHT / 2;

  // HUD
  private scoreText!: Phaser.GameObjects.Text;
  private sizeText!:  Phaser.GameObjects.Text;

  // particles
  private eatParticles: { x: number; y: number; vx: number; vy: number; life: number; color: number }[] = [];

  constructor() { super('GameScene'); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.gfx = this.add.graphics();
    this.px = W / 2; this.py = H / 2;
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
    this.foods = []; this.enemies = []; this.allies = [];
    this.eatParticles = []; this.enemyBiteCD = new Map();
    this.foodTimer = 0; this.enemyTimer = 0; this.bigEnemyTimer = 0;

    this.scoreText = this.add.text(16, 18, 'Очки: 0', {
      fontSize: '20px', color: '#a8d8c0', fontFamily: 'monospace',
    }).setDepth(10);
    this.sizeText = this.add.text(16, 44, '', {
      fontSize: '14px', color: '#6abf98', fontFamily: 'monospace',
    }).setDepth(10);

    this.initSnow(W, H);
    this.spawnInitialFood();
    this.spawnInitialBubbles(W, H);
    this.spawnInitialAllies(W, H);

    this.pCursorX = W / 2; this.pCursorY = H / 2;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointer  = p;
      this.pCursorX = p.x; this.pCursorY = p.y;
    });
    this.input.on('pointerup', () => { this.pointer = null; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.pCursorX = p.x; this.pCursorY = p.y;
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

    // passive HP regen
    this.pHp = Math.min(this.pMaxHp, this.pHp + HP_REGEN * delta / 1000);

    this.updatePlayer(delta, W, H);
    this.updateFood(delta, W, H);
    this.updateEnemies(delta, W, H);
    this.updateAllies(delta, W, H);
    this.updateBubbles(delta, W, H);
    this.updateSnow(delta, W, H);
    this.checkCollisions(delta);
    this.render(W, H);
  }

  // ── Player ──────────────────────────────────────────────────────────────────

  private updatePlayer(delta: number, W: number, H: number) {
    const dt = delta / 1000;
    this.pBp1      += dt * 2.20;
    this.pBp2      += dt * 1.55;
    this.pBp3      += dt * 3.00;
    this.pFinPhase += dt * 2.6;

    if (this.pointer && this.pointer.isDown) {
      const dx = this.pointer.x - this.px;
      const dy = this.pointer.y - this.py;
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
    this.px = Phaser.Math.Clamp(this.px, this.pRadius, W - this.pRadius);
    this.py = Phaser.Math.Clamp(this.py, this.pRadius, H - this.pRadius);

    // rotate cell toward cursor, not movement direction
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
    const W = this.scale.width, H = this.scale.height, m = 40;
    const x = Phaser.Math.Between(m, W - m);
    const y = Phaser.Math.Between(m, H - m);
    const type: FoodType = Math.random() < 0.6 ? 'green' : 'red';
    this.foods.push(new Food(this, x, y, type, CONFIG.food.radius));
  }

  private updateFood(delta: number, W: number, H: number) {
    if (this.foodTimer > CONFIG.food.spawnInterval && this.foods.length < CONFIG.food.count) {
      this.spawnFood(); this.foodTimer = 0;
    }
    for (const f of this.foods) f.update(delta, W, H);
    this.foods = this.foods.filter(f => f.alive);
  }

  // ── Allies ───────────────────────────────────────────────────────────────────

  private spawnInitialAllies(W: number, H: number) {
    for (let i = 0; i < CONFIG.ally.count; i++) {
      const margin = 80;
      const x = Phaser.Math.Between(margin, W - margin);
      const y = Phaser.Math.Between(margin, H - margin);
      this.allies.push(new AllyCell(this, x, y, CONFIG.ally.radius, CONFIG.ally.speed));
    }
  }

  private updateAllies(delta: number, W: number, H: number) {
    for (const a of this.allies) {
      a.updateAI(delta, W, H, this.px, this.py, this.enemies, this.pBiting);
    }

    // allies eat food
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

  // ── Enemies ─────────────────────────────────────────────────────────────────

  private spawnEnemy(big = false) {
    const W = this.scale.width, H = this.scale.height;
    const side = Phaser.Math.Between(0, 3);
    let x = 0, y = 0;
    const r = big ? CONFIG.bigEnemy.radius : CONFIG.enemy.radius;
    if      (side === 0) { x = Phaser.Math.Between(r, W - r); y = -r; }
    else if (side === 1) { x = W + r; y = Phaser.Math.Between(r, H - r); }
    else if (side === 2) { x = Phaser.Math.Between(r, W - r); y = H + r; }
    else                 { x = -r;    y = Phaser.Math.Between(r, H - r); }
    const spd = big ? CONFIG.bigEnemy.speed : CONFIG.enemy.speed;
    this.enemies.push(new EnemyCell(this, x, y, spd, r, big));
  }

  private updateEnemies(delta: number, W: number, H: number) {
    if (this.enemyTimer > CONFIG.enemy.spawnInterval) {
      const normalCount = this.enemies.filter(e => !e.isBig).length;
      if (normalCount < CONFIG.enemy.count) { this.spawnEnemy(false); }
      this.enemyTimer = 0;
    }

    if (this.bigEnemyTimer > CONFIG.bigEnemy.spawnInterval) {
      const bigCount = this.enemies.filter(e => e.isBig).length;
      if (bigCount < CONFIG.bigEnemy.count) { this.spawnEnemy(true); }
      this.bigEnemyTimer = 0;
    }

    for (const e of this.enemies) {
      e.isBiting = false;
      // track the closest living target (player or ally) within aggro range
      let nearX = this.px, nearY = this.py;
      let nearDist = Math.hypot(this.px - e.x, this.py - e.y);
      for (const a of this.allies) {
        if (!a.alive) continue;
        const ad = Math.hypot(a.x - e.x, a.y - e.y);
        if (ad < nearDist) { nearDist = ad; nearX = a.x; nearY = a.y; }
      }
      e.update(delta, W, H, nearX, nearY);
    }

    // enemies eat food
    for (const e of this.enemies) {
      if (e.isBig) continue; // big enemies don't bother with food
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

    // player eats food (also heals)
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

    // player vs enemies
    this.pBiting = false;
    for (const e of this.enemies) {
      const dist = Math.hypot(this.px - e.x, this.py - e.y);
      if (dist >= this.pRadius + e.radius) continue;

      // player bites enemy — damage scales with player growth
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

      // enemy bites player from jowl side only
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

    // ally bites enemies
    for (const a of this.allies) {
      if (!a.isBiting) continue;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(a.x - e.x, a.y - e.y);
        if (d < a.radius + e.radius + 6) {
          // cooperation bonus: +40% damage when player also biting
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

    // big enemies bite allies
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
              a.takeDamage(95); // one-shots most ally cells
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
    const g = this.gfx;
    g.clear();
    this.drawOcean(g, W, H);
    this.drawSnow(g);
    this.drawBubbles(g);
    for (const f of this.foods)  f.draw(g);
    for (const a of this.allies) a.draw(g);
    for (const e of this.enemies) e.draw(g);
    this.drawEatParticles(g);
    this.drawPlayer(g);
    this.drawHUD(g, W);
  }

  // ── Ocean ───────────────────────────────────────────────────────────────────

  private drawOcean(g: Phaser.GameObjects.Graphics, W: number, H: number) {
    // ── base depth gradient ──────────────────────────────────────────────
    g.fillStyle(0x041828, 1);    g.fillRect(0, 0,        W, H);
    g.fillStyle(0x0d3a6a, 0.92); g.fillRect(0, 0,        W, H * 0.55);
    g.fillStyle(0x1a5888, 0.50); g.fillRect(0, 0,        W, H * 0.28);
    g.fillStyle(0x2a88c8, 0.28); g.fillRect(0, 0,        W, H * 0.10);
    g.fillStyle(0x020c14, 0.55); g.fillRect(0, H * 0.60, W, H * 0.40);

    const t = this.time.now / 1000;

    // ── god rays ─────────────────────────────────────────────────────────
    this.drawGodRays(g, W, H, t);

    // ── water current bands ──────────────────────────────────────────────
    const wt = t / 1.8;
    for (let i = 0; i < 6; i++) {
      const baseY = H * (0.08 + i * 0.145);
      const amp   = (8 + 5 * Math.sin(i * 1.8)) * (H / 800);
      const thick = (18 + 8 * Math.abs(Math.sin(i * 2.3))) * (H / 800);
      const alpha = 0.030 + 0.018 * Math.abs(Math.sin(i * 0.9 + wt * 0.3));
      g.fillStyle(0x4aa8d8, alpha);
      g.beginPath();
      for (let xi = 0; xi <= W + 12; xi += 12) {
        const y = baseY + amp * Math.sin((xi / W) * Math.PI * 3.5 + wt * (0.5 + i * 0.1) + i * 1.05);
        xi === 0 ? g.moveTo(xi, y) : g.lineTo(xi, y);
      }
      for (let xi = W; xi >= 0; xi -= 12) {
        const y = baseY + thick + amp * Math.sin((xi / W) * Math.PI * 3.5 + wt * (0.5 + i * 0.1) + i * 1.05 + 0.35);
        g.lineTo(xi, y);
      }
      g.closePath(); g.fillPath();
    }

    // ── caustic network ──────────────────────────────────────────────────
    this.drawCaustics(g, W, H, t);

    // ── surface glow strip ───────────────────────────────────────────────
    g.fillStyle(0x60c8ff, 0.07); g.fillRect(0, 0, W, H * 0.04);
    g.fillStyle(0x90d8ff, 0.04); g.fillRect(0, 0, W, H * 0.015);

    // ── edge + seabed vignette ────────────────────────────────────────────
    g.fillStyle(0x000000, 0.14); g.fillRect(0,          0, W * 0.055, H);
    g.fillStyle(0x000000, 0.14); g.fillRect(W * 0.945,  0, W * 0.055, H);
    g.fillStyle(0x081420, 0.65); g.fillRect(0, H * 0.92, W, H * 0.08);
    g.fillStyle(0x102030, 0.38); g.fillRect(0, H * 0.90, W, H * 0.04);
  }

  private drawGodRays(g: Phaser.GameObjects.Graphics, W: number, H: number, t: number) {
    // Each shaft: position (0-1), phase offset, top/bottom width (fraction of W),
    // reach (fraction of H), sway speed, sway amplitude, base opacity
    const rays = [
      { x: 0.07, ph: 0.00, tw: 0.007, bw: 0.052, len: 0.74, spd: 0.17, amp: 0.013, al: 0.058 },
      { x: 0.16, ph: 1.30, tw: 0.004, bw: 0.036, len: 0.88, spd: 0.23, amp: 0.010, al: 0.038 },
      { x: 0.27, ph: 2.50, tw: 0.009, bw: 0.060, len: 0.62, spd: 0.14, amp: 0.017, al: 0.062 },
      { x: 0.38, ph: 0.80, tw: 0.005, bw: 0.042, len: 0.82, spd: 0.20, amp: 0.010, al: 0.044 },
      { x: 0.50, ph: 3.20, tw: 0.010, bw: 0.055, len: 0.70, spd: 0.16, amp: 0.015, al: 0.055 },
      { x: 0.61, ph: 1.75, tw: 0.005, bw: 0.038, len: 0.84, spd: 0.21, amp: 0.011, al: 0.040 },
      { x: 0.73, ph: 0.50, tw: 0.011, bw: 0.057, len: 0.58, spd: 0.15, amp: 0.018, al: 0.060 },
      { x: 0.84, ph: 2.70, tw: 0.006, bw: 0.044, len: 0.78, spd: 0.19, amp: 0.012, al: 0.042 },
      { x: 0.93, ph: 1.10, tw: 0.008, bw: 0.050, len: 0.66, spd: 0.18, amp: 0.014, al: 0.050 },
    ];

    for (const r of rays) {
      const sway = Math.sin(t * r.spd + r.ph) * W * r.amp;
      const topX = W * r.x + sway * 0.20;   // top moves less (surface anchor)
      const botX = W * r.x + sway;           // bottom drifts with current
      const len  = H * r.len;
      const tw   = W * r.tw;
      const bw   = W * r.bw;

      // draw 5 gradient segments: bright at top, fades to transparent at bottom
      const SEGS = 5;
      for (let s = 0; s < SEGS; s++) {
        const t0 = s / SEGS;
        const t1 = (s + 1) / SEGS;
        const al = r.al * (1 - t0 * 0.92);   // 0% → ~92% fade across length
        const y0  = t0 * len, y1 = t1 * len;
        const cx0 = topX + (botX - topX) * t0;
        const cx1 = topX + (botX - topX) * t1;
        const hw0 = (tw + (bw - tw) * t0) * 0.5;
        const hw1 = (tw + (bw - tw) * t1) * 0.5;
        g.fillStyle(0xb0dcff, al);
        g.beginPath();
        g.moveTo(cx0 - hw0, y0); g.lineTo(cx0 + hw0, y0);
        g.lineTo(cx1 + hw1, y1); g.lineTo(cx1 - hw1, y1);
        g.closePath(); g.fillPath();
      }

      // bright white core — top third only, narrow
      g.fillStyle(0xffffff, r.al * 0.20);
      const cLen = len * 0.28;
      g.beginPath();
      g.moveTo(topX - tw * 0.15, 0); g.lineTo(topX + tw * 0.15, 0);
      g.lineTo(botX + bw * 0.10, cLen); g.lineTo(botX - bw * 0.10, cLen);
      g.closePath(); g.fillPath();
    }
  }

  private drawCaustics(g: Phaser.GameObjects.Graphics, W: number, H: number, t: number) {
    // caustics = bright irregular network where light focuses through surface ripples
    const ROWS = 4, COLS = 6;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const i  = row * COLS + col;
        const cx = W * ((col + 0.5) / COLS) + Math.sin(t * 0.60 + i * 1.15) * W * 0.036;
        const cy = H * (0.03 + row * 0.17)  + Math.cos(t * 0.45 + i * 0.88) * H * 0.020;
        const cr = (16 + 10 * Math.abs(Math.sin(t * 1.05 + i * 0.68))) * (H / 800);
        const al = 0.10 + 0.06 * Math.abs(Math.sin(t * 0.80 + i));
        const tc = t * 1.55 + i * 0.52;    // per-patch time for shape morph
        const N  = 7;

        // organic outline — faint fill + bright stroke = caustic ring
        g.fillStyle(0x70b8e0, al * 0.22);
        g.lineStyle(0.9, 0x98d8f8, al * 1.6);
        g.beginPath();
        for (let k = 0; k <= N; k++) {
          const a = (k / N) * Math.PI * 2;
          const d = 1 + 0.38 * Math.sin(a * 3 + tc) + 0.22 * Math.cos(a * 2 + tc * 0.72);
          const px = cx + Math.cos(a) * cr * d;
          const py = cy + Math.sin(a) * cr * d;
          k === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
        }
        g.closePath();
        g.fillPath();
        g.strokePath();  // path stays after fillPath — stroke the same shape

        // inner satellite lobe (secondary focus)
        const sx = cx + Math.cos(tc * 0.4) * cr * 0.65;
        const sy = cy + Math.sin(tc * 0.3) * cr * 0.55;
        const sr = cr * 0.42;
        g.fillStyle(0x80c8f0, al * 0.15);
        g.lineStyle(0.7, 0x90d0f8, al * 1.0);
        g.beginPath();
        for (let k = 0; k <= N; k++) {
          const a = (k / N) * Math.PI * 2;
          const d = 1 + 0.30 * Math.sin(a * 2 + tc * 1.2) + 0.18 * Math.cos(a * 3 - tc * 0.8);
          g.lineTo(sx + Math.cos(a) * sr * d, sy + Math.sin(a) * sr * d);
        }
        g.closePath();
        g.fillPath();
        g.strokePath();
      }
    }
  }

  private drawSnow(g: Phaser.GameObjects.Graphics) {
    for (const s of this.snow) {
      g.fillStyle(0xc8dff8, s.alpha);
      g.fillCircle(s.x, s.y, s.r);
    }
  }

  private drawBubbles(g: Phaser.GameObjects.Graphics) {
    for (const b of this.bubbles) {
      g.lineStyle(0.8, 0x9ad0e8, b.alpha * 0.85);
      g.strokeCircle(b.x, b.y, b.r);
      g.fillStyle(0xffffff, b.alpha * 0.30);
      g.fillCircle(b.x - b.r * 0.28, b.y - b.r * 0.28, b.r * 0.25);
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
    // HP bar at top-right
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
    // HP bar border
    g.lineStyle(1, 0x60c8a0, 0.45);
    g.strokeRoundedRect(bx, by, bw, bh, 3);

    // ally count dots
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
    const r   = this.pRadius;
    const dir = this.pDir;
    const flicker = this.invincible > 0 && Math.floor(this.invincible / 80) % 2 === 0;
    if (flicker) return;

    const p1 = this.pBp1, p2 = this.pBp2, p3 = this.pBp3;

    // area-conserving dynamic deformation along facing direction
    const spd     = Math.hypot(this.pvx, this.pvy);
    const sf      = Math.min(1, spd / (CONFIG.player.speed * 1.1));
    const pulse   = 1 + 0.09 * Math.sin(this.pFinPhase * 0.38);
    const stretch = (1 + 0.28 * sf) * pulse;
    const rx  = r * this.pRxF * stretch;
    const ry  = r * this.pRyF / stretch;
    const cosD = Math.cos(dir);
    const sinD = Math.sin(dir);

    drawFlagellum(g, this.px, this.py, r, dir, this.pFinPhase, P_MEMBRANE);

    g.fillStyle(P_BODY, 0.11);
    fillBlob(g, this.px, this.py, rx * 1.40, ry * 1.40, p1, p2, p3, 28, dir);

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

    const nr  = r * 0.31;
    const nx  = this.px + (this.pNox * cosD - this.pNoy * sinD) * r * 0.36;
    const ny  = this.py + (this.pNox * sinD + this.pNoy * cosD) * r * 0.36;
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
