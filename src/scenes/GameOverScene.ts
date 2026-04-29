import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/game.config';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }

  init(data: { score: number }) {
    const best = Number(localStorage.getItem('cellz_best') ?? 0);
    if (data.score > best) localStorage.setItem('cellz_best', String(data.score));
  }

  create(data: { score: number }) {
    const best = Number(localStorage.getItem('cellz_best') ?? 0);

    const g = this.add.graphics();
    g.fillStyle(0x0c2a4a, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.28, 'Съели...', {
      fontSize: '44px', color: '#f87171', fontFamily: 'monospace',
      stroke: '#7f1d1d', strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.44, `Очки: ${data.score}`, {
      fontSize: '32px', color: '#e0f2fe', fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.54, `Рекорд: ${best}`, {
      fontSize: '22px', color: '#7dd3fc', fontFamily: 'monospace',
    }).setOrigin(0.5);

    const btn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.7, '↺  ЕЩЁ РАЗ', {
      fontSize: '26px', color: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#065f46', padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => this.scene.start('GameScene'));
    btn.on('pointerover', () => btn.setStyle({ color: '#34d399' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#ffffff' }));
  }
}
