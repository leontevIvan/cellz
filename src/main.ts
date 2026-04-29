import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config/game.config';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0c2a4a',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MenuScene, GameScene, GameOverScene],
  input: { activePointers: 2 },
  render: { antialias: true },
};

new Phaser.Game(config);
