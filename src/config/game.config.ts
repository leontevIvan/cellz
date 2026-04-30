export const GAME_WIDTH  = window.innerWidth;
export const GAME_HEIGHT = window.innerHeight;
export const WORLD_W     = GAME_WIDTH  * 3;
export const WORLD_H     = GAME_HEIGHT * 3;

export const CONFIG = {
  player: {
    radius: 36,
    speed: 200,
    maxHp: 220,
  },
  food: {
    spawnInterval: 1200,
    count: 35,
    radius: 10,
  },
  enemy: {
    spawnInterval: 3500,
    count: 18,
    radius: 28,
    speed: 52,
  },
  bigEnemy: {
    spawnInterval: 14000,
    count: 6,
    radius: 88,
    speed: 24,
  },
  ally: {
    count: 3,
    radius: 32,
    speed: 175,
  },
  bubble: {
    count: 22,
  },
};
