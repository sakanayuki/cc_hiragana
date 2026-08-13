export type Mode = 'free' | 'quiz';

const HOLD_MS = 1200;

const MODE_LABEL: Record<Mode, string> = {
  free: 'あそぶ',
  quiz: 'クイズ',
};

/**
 * モード切替は大人だけが開ける入口にする。
 *
 * 子どもは画面のあちこちを無差別に触るので、ふつうのボタンだと遊んでいる最中に
 * 勝手にモードが変わってしまう。1.2 秒の長押しでだけ開き、押している間は
 * リングで進み具合を見せて大人が気づけるようにする。
 */
export class ModeSwitch {
  readonly el: HTMLButtonElement;
  private ring: HTMLSpanElement;
  private raf: number | null = null;
  private holdStart = 0;
  private sheet: HTMLDivElement | null = null;

  constructor(
    private getMode: () => Mode,
    private onChange: (mode: Mode) => void,
  ) {
    this.el = document.createElement('button');
    this.el.type = 'button';
    this.el.className = 'mode-toggle';
    this.el.setAttribute('aria-label', 'おとなメニュー（ながおし）');

    this.ring = document.createElement('span');
    this.ring.className = 'mode-toggle__ring';

    const glyph = document.createElement('span');
    glyph.className = 'mode-toggle__glyph';
    glyph.textContent = '⚙';

    this.el.append(this.ring, glyph);

    this.el.addEventListener('pointerdown', this.beginHold);
    this.el.addEventListener('pointerup', this.cancelHold);
    this.el.addEventListener('pointerleave', this.cancelHold);
    this.el.addEventListener('pointercancel', this.cancelHold);
  }

  private beginHold = (ev: PointerEvent): void => {
    ev.preventDefault();
    this.el.setPointerCapture?.(ev.pointerId);
    this.holdStart = performance.now();
    const tick = (): void => {
      const progress = Math.min(1, (performance.now() - this.holdStart) / HOLD_MS);
      this.el.style.setProperty('--hold', String(progress));
      if (progress >= 1) {
        this.raf = null;
        this.el.style.setProperty('--hold', '0');
        this.openSheet();
        return;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  };

  private cancelHold = (): void => {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.el.style.setProperty('--hold', '0');
  };

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
