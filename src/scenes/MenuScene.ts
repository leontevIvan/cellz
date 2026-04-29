import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/game.config';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    // ocean bg
    const g = this.add.graphics();
    g.fillStyle(0x0c2a4a, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, 'Cellz', {
      fontSize: '64px', color: '#34d399', fontFamily: 'monospace',
      stroke: '#064e3b', strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.48, 'Ешь комочки\nБеги от чужих клеток', {
      fontSize: '20px', color: '#bae6fd', fontFamily: 'monospace', align: 'center',
    }).setOrigin(0.5);

    const btn = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.68, '▶  ИГРАТЬ', {
      fontSize: '28px', color: '#ffffff', fontFamily: 'monospace',
      backgroundColor: '#065f46', padding: { x: 28, y: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => this.scene.start('GameScene'));
    btn.on('pointerover', () => btn.setStyle({ color: '#34d399' }));
    btn.on('pointerout', () => btn.setStyle({ color: '#ffffff' }));
  }
}
