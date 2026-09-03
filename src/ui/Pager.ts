import type { Board } from './Board';

/**
 * 行のページ送り。スマホのように 1 画面へ全 10 行を並べると 1 マスが
 * 小さくなりすぎる端末でだけ出る。
 *
 * 3歳児が自分で押せるよう、矢印は画面下に大きく置く。端でも止まらず
 * 一周するので「押しても何も起きない」状態を作らない。
 */
export class Pager {
  readonly el: HTMLDivElement;
  private dots: HTMLDivElement;
  private label: HTMLSpanElement;

  constructor(private board: Board) {
    this.el = document.createElement('div');
    this.el.className = 'pager';

    const prev = this.arrow('◀', 'まえの ぎょう', -1);
    const next = this.arrow('▶', 'つぎの ぎょう', 1);

    const middle = document.createElement('div');
    middle.className = 'pager__middle';

    this.label = document.createElement('span');
    this.label.className = 'pager__label';

    this.dots = document.createElement('div');
    this.dots.className = 'pager__dots';

    middle.append(this.label, this.dots);
    this.el.append(prev, middle, next);
    this.render();
  }

  private arrow(glyph: string, label: string, step: number): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pager__arrow';
    b.textContent = glyph;
    b.setAttribute('aria-label', label);
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      this.board.goToPage(this.board.currentPage + step);
    });
    return b;
  }

  render(): void {
    this.label.textContent = this.board.pageLabel(this.board.currentPage);
    const dots = Array.from({ length: this.board.pageCount }, (_, i) => {
      const d = document.createElement('span');
      d.className = 'pager__dot';
      d.classList.toggle('is-on', i === this.board.currentPage);
      return d;
    });
    this.dots.replaceChildren(...dots);
  }
}
