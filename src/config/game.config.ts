export const GAME_WIDTH = window.innerWidth;
export const GAME_HEIGHT = window.innerHeight;

export const CONFIG = {
  player: {
    radius: 36,
    speed: 160,
    maxHp: 100,
  },
  food: {
    spawnInterval: 1200,
    count: 10,
    radius: 10,
  },
  enemy: {
    spawnInterval: 3500,
    count: 5,
    radius: 28,
    speed: 60,
  },
  bigEnemy: {
    spawnInterval: 14000,
    count: 2,
    radius: 88,
    speed: 38,
  },
  ally: {
    count: 2,
    radius: 32,
    speed: 130,
  },
  bubble: {
    count: 18,
  },
};
