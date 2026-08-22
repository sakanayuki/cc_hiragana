import { CHARACTERS, KANA_ROWS, type KanaEntry } from '../data/characters';
import { withBase } from '../audio/AudioEngine';

export type CellEffect = 'pressed' | 'correct' | 'wrong';

/** 段の数 (あ・い・う・え・お)。 */
const DAN_COUNT = 5;

const EFFECT_CLASS: Record<CellEffect, string> = {
  pressed: 'is-pressed',
  correct: 'is-correct',
  wrong: 'is-wrong',
};

/**
 * 五十音表そのもの。自由タップモードとクイズモードで同じものを使う。
 *
 * 並びは CSS 側 (board.css) のメディアクエリが決める。ここでは各マスに
 * 縦持ち用と横長用の座標を両方持たせておくだけなので、端末を回した瞬間に
 * JS を介さず並び替わる。
 */
export class Board {
  readonly el: HTMLDivElement;
  private cells = new Map<number, HTMLButtonElement>();

  constructor(private onTap: (entry: KanaEntry, cell: HTMLButtonElement) => void) {
    this.el = document.createElement('div');
    this.el.className = 'board';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'ひらがなひょう');
    // 行数を CSS に渡す。列数・行数はここから算出されるので、
    // KANA_ROWS に行を足すだけで盤面が組み替わる (board.css 参照)。
    this.el.style.setProperty('--row-count', String(KANA_ROWS.length));

    for (const entry of CHARACTERS) {
      const cell = this.createCell(entry);
      this.cells.set(entry.id, cell);
      this.el.append(cell);
    }
  }

  private createCell(entry: KanaEntry): HTMLButtonElement {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.row = entry.row;
    cell.dataset.id = String(entry.id);
    cell.setAttribute('aria-label', `${entry.kana} ${entry.word}`);

    // 縦持ち: 五十音表と同じく右の列から あ行 → か行。段が行になる。
    const rowIndex = KANA_ROWS.indexOf(entry.row);
    if (rowIndex >= 0) {
      cell.style.setProperty('--p-col', String(KANA_ROWS.length - rowIndex));
      cell.style.setProperty('--p-row', String(entry.col + 1));
      // 横長: 素材画像と同じ横並び。行がそのまま行になる。
      cell.style.setProperty('--l-col', String(entry.col + 1));
      cell.style.setProperty('--l-row', String(rowIndex + 1));
    } else {
      // おまけの「ん」は最下段。縦持ちでは全幅、横長では中央の 1 マス。
      cell.style.setProperty('--p-row', String(DAN_COUNT + 1));
      cell.style.setProperty('--l-col', '3');
      cell.style.setProperty('--l-row', String(KANA_ROWS.length + 1));
    }

    const kana = document.createElement('span');
    kana.className = 'cell__kana';
    kana.textContent = entry.kana;
    kana.setAttribute('aria-hidden', 'true');

    const icon = document.createElement('img');
    icon.className = 'cell__icon';
    icon.src = withBase(entry.icon);
    icon.alt = '';
    icon.decoding = 'async';

    cell.append(kana, icon);

    // click ではなく pointerdown。click は 100〜300ms 遅れ、3歳児には鈍く感じる。
    cell.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      this.onTap(entry, cell);
    });

    return cell;
  }

  cell(id: number): HTMLButtonElement | undefined {
    return this.cells.get(id);
  }

  /** アニメーションを掛け直す。連打されても必ず最初から再生されるようにする。 */
  flash(cell: HTMLButtonElement, effect: CellEffect): void {
    const cls = EFFECT_CLASS[effect];
    cell.classList.remove(...Object.values(EFFECT_CLASS));
    // リフローを挟んでアニメーションを確実に再スタートさせる
    void cell.offsetWidth;
    cell.classList.add(cls);
    cell.addEventListener(
      'animationend',
      () => cell.classList.remove(cls),
      { once: true },
    );
  }

  setHint(id: number | null): void {
    for (const [cellId, cell] of this.cells) {
      cell.classList.toggle('is-hinted', cellId === id);
    }
  }

  setInteractive(enabled: boolean): void {
    for (const cell of this.cells.values()) {
      cell.disabled = !enabled;
      cell.style.pointerEvents = enabled ? '' : 'none';
    }
  }

  clearEffects(): void {
    for (const cell of this.cells.values()) {
      cell.classList.remove(...Object.values(EFFECT_CLASS), 'is-hinted');
    }
  }
}
