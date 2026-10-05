import Phaser from 'phaser';
import { BOARD_HEIGHT, BOARD_WIDTH, GameScene } from './GameScene';

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    backgroundColor: '#101b29',
    scene: [GameScene],
    render: { antialias: true },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
}
