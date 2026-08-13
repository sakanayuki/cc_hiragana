/**
 * タップした文字を画面中央にドンと出す演出。
 * 文字の形を印象づけるのが目的なので、絵よりも文字を主役にする。
 * 連打されたら即座に差し替わる。
 */
export class KanaBurst {
  readonly el: HTMLDivElement;
  private timer: number | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'kana-burst';
    this.el.setAttribute('aria-hidden', 'true');
  }

  show(kana: string): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.el.replaceChildren();

    // 文字の後ろに淡い幕を敷く。盤面の絵が透けたままだと文字が読み取れない。
    const scrim = document.createElement('span');
    scrim.className = 'kana-burst__scrim';

    const char = document.createElement('span');
    char.className = 'kana-burst__char';
    char.textContent = kana;
    this.el.append(scrim, char);

    this.timer = window.setTimeout(() => {
      this.el.replaceChildren();
      this.timer = null;
    }, 760);
  }

  destroy(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.el.remove();
  }
}
