export type Mode = 'free' | 'quiz';

const MODE_LABEL: Record<Mode, string> = {
  free: 'あそぶ',
  quiz: 'クイズ',
};

/**
 * モード切替の入口。画面隅の歯車を 1 回タップするとシートが開く。
 *
 * もとは子どもの誤タップを避けるため 1.2 秒の長押しにしていたが、
 * 大人でも開き方が分かりにくかったので普通のタップに変えた。
 * 誤って開いても「とじる」か背景タップですぐ戻れる。
 */
export class ModeSwitch {
  readonly el: HTMLButtonElement;
  private sheet: HTMLDivElement | null = null;

  constructor(
    private getMode: () => Mode,
    private onChange: (mode: Mode) => void,
  ) {
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'mode-toggle';
    this.el.setAttribute('aria-label', 'おとなメニュー');

    const glyph = document.createElement('span');
    glyph.className = 'mode-toggle__glyph';
    glyph.textContent = '⚙';
    this.el.append(glyph);

    this.el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      this.openSheet();
    });
  }

  private openSheet(): void {
    if (this.sheet) return;

    const sheet = document.createElement('div');
    sheet.className = 'mode-sheet';

    const panel = document.createElement('div');
    panel.className = 'mode-sheet__panel';

    const heading = document.createElement('p');
    heading.className = 'mode-sheet__heading';
    heading.textContent = 'モードをえらぶ';
    panel.append(heading);

    for (const mode of ['free', 'quiz'] as const) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'mode-sheet__option';
      option.classList.toggle('is-current', this.getMode() === mode);
      option.textContent = MODE_LABEL[mode];
      option.addEventListener('click', () => {
        this.closeSheet();
        if (this.getMode() !== mode) this.onChange(mode);
      });
      panel.append(option);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'mode-sheet__close';
    close.textContent = 'とじる';
    close.addEventListener('click', () => this.closeSheet());
    panel.append(close);

    sheet.append(panel);
    // 背景を触ったときも閉じる（パネル内のクリックは拾わない）
    sheet.addEventListener('click', (ev) => {
      if (ev.target === sheet) this.closeSheet();
    });

    this.sheet = sheet;
    document.getElementById('app')?.append(sheet);
  }

  private closeSheet(): void {
    this.sheet?.remove();
    this.sheet = null;
  }
}
