import { audio } from '../audio/AudioEngine';
import { playTap } from '../audio/sfx';
import { Board } from './Board';
import { KanaBurst } from './KanaBurst';
import { Pager } from './Pager';

/**
 * 自由タップモード（既定）。
 * 点数も進み具合も持たない。触ると鳴って跳ねる、それだけの画面。
 */
export class FreeMode {
  readonly el: HTMLDivElement;
  private board: Board;
  private pager: Pager;
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

    this.pager = new Pager(this.board);
    this.board.el.append(this.pager.el);
    this.board.onLayout = () => this.pager.render();

    this.el.append(this.board.el, this.burst.el);
  }

  destroy(): void {
    audio.stopVoice();
    this.board.destroy();
    this.burst.destroy();
    this.el.remove();
  }
}
