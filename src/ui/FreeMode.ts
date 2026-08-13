import { audio } from '../audio/AudioEngine';
import { playTap } from '../audio/sfx';
import { Board } from './Board';
import { KanaBurst } from './KanaBurst';

/**
 * 自由タップモード（既定）。
 * 点数も進み具合も持たない。触ると鳴って跳ねる、それだけの画面。
 */
export class FreeMode {
  readonly el: HTMLDivElement;
  private board: Board;
  private burst = new KanaBurst();

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'screen free';

    this.board = new Board((entry, cell) => {
      playTap();
      audio.speak(entry);
      this.board.flash(cell, 'pressed');
      this.burst.show(entry.kana);
    });

    const area = document.createElement('div');
    area.className = 'board-area';
    area.append(this.board.el);

    this.el.append(area, this.burst.el);
  }

  destroy(): void {
    audio.stopVoice();
    this.burst.destroy();
    this.el.remove();
  }
}
