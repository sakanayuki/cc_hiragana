import { CHARACTERS, KANA_ROWS, type KanaEntry } from '../data/characters';
import { withBase } from '../audio/AudioEngine';

export type CellEffect = 'pressed' | 'correct' | 'wrong';

/** 段の数 (あ・い・う・え・お)。 */
const DAN_COUNT = 5;

/**
 * 縦持ちで 1 ページに載せる行の数。
 * あ・か・さ・た・な で 1 ページ、は・ま・や・ら・わ で 1 ページの 2 ページ構成。
 * 横持ちは幅に余裕があるので分割せず、全 10 行を 1 ページに並べる。
 */
const ROWS_PER_PAGE_PORTRAIT = 5;

const EFFECT_CLASS: Record<CellEffect, string> = {
  pressed: 'is-pressed',
  correct: 'is-correct',
  wrong: 'is-wrong',
};

/**
 * 五十音表そのもの。自由タップモードとクイズモードで同じものを使う。
 *

 * 並びは五十音表そのままで、行が列 (右から あ行 → か行 → …)、段が行になる。
 * 縦持ちは幅が足りないので あ〜な / は〜わ の 2 ページに分けて送り、
 * 横持ちは幅に余裕があるので全 10 行を 1 ページに並べる。
 * おまけの「ん」は最後のページの最下段にだけ置く (横持ちでは常に見える)。
 */
export class Board {
  /** board-area とページャをまとめた外枠。 */
  readonly el: HTMLDivElement;
  private area: HTMLDivElement;
  private grid: HTMLDivElement;
  private cells = new Map<number, HTMLButtonElement>();
  private rowOf = new Map<number, number>();

  private page = 0;
  private portrait = window.matchMedia('(orientation: portrait)');
  private onOrientation = () => this.applyLayout();

  /** ページ構成が変わったときに呼ばれる (ページャの描画用)。 */
  onLayout: (() => void) | null = null;

  constructor(private onTap: (entry: KanaEntry, cell: HTMLButtonElement) => void) {
    this.el = document.createElement('div');
    this.el.className = 'board-wrap';

    this.area = document.createElement('div');
    this.area.className = 'board-area';

    this.grid = document.createElement('div');
    this.grid.className = 'board';
    this.grid.setAttribute('role', 'group');
    this.grid.setAttribute('aria-label', 'ひらがなひょう');

    for (const entry of CHARACTERS) {
      const cell = this.createCell(entry);
      this.cells.set(entry.id, cell);
      this.rowOf.set(entry.id, KANA_ROWS.indexOf(entry.row));
      this.grid.append(cell);
    }

    this.area.append(this.grid);
    this.el.append(this.area);

    this.portrait.addEventListener('change', this.onOrientation);
    this.applyLayout();
  }

  /** 縦持ちなら 5 行ずつ、横持ちなら全行を 1 ページに。 */
  private get rowsPerPage(): number {
    return this.portrait.matches ? ROWS_PER_PAGE_PORTRAIT : KANA_ROWS.length;
  }

  /** 向きが変わったときに、ページ数と列数を入れ直す。 */
  private applyLayout(): void {
    this.page = Math.min(this.page, this.pageCount - 1);
    this.grid.style.setProperty('--row-count', String(this.rowsPerPage));
    this.el.classList.toggle('is-single-page', this.pageCount === 1);
    this.apply();
    this.onLayout?.();
  }

  private createCell(entry: KanaEntry): HTMLButtonElement {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.row = entry.row;
    cell.dataset.id = String(entry.id);
    cell.setAttribute('aria-label', `${entry.kana} ${entry.word}`);

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

  private apply(): void {
    const slots = this.rowsPerPage;
    const start = this.page * slots;
    const end = Math.min(start + slots, KANA_ROWS.length);
    const lastPage = this.page === this.pageCount - 1;

    for (const [id, cell] of this.cells) {
      const rowIndex = this.rowOf.get(id) ?? -1;
      if (rowIndex < 0) {
        // おまけの「ん」は最後のページ (は〜わ) の最下段にだけ置く。
        cell.hidden = !lastPage;
        cell.style.setProperty('--p-row', String(DAN_COUNT + 1));
        continue;
      }
      const within = rowIndex >= start && rowIndex < end;
      cell.hidden = !within;
      if (!within) continue;
      // 五十音表と同じく右の列から あ行 → か行 → …。段が行になる。
      const offset = rowIndex - start;
      cell.style.setProperty('--p-col', String(slots - offset));
      cell.style.setProperty('--p-row', String((this.entryCol(id) ?? 0) + 1));
    }
  }

  private entryCol(id: number): number | undefined {
    return CHARACTERS.find((c) => c.id === id)?.col;
  }

  get pageCount(): number {
    return Math.ceil(KANA_ROWS.length / this.rowsPerPage);
  }

  get currentPage(): number {
    return this.page;
  }

  /** そのページに含まれる行の名前 (ページャの見出し用)。 */
  pageLabel(page: number): string {
    const start = page * this.rowsPerPage;
    const rows = KANA_ROWS.slice(start, start + this.rowsPerPage);
    const head = CHARACTERS.find((c) => c.row === rows[0]);
    const tail = CHARACTERS.find((c) => c.row === rows[rows.length - 1]);
    if (!head || !tail) return '';
    return rows.length === 1 ? `${head.kana}` : `${head.kana}〜${tail.kana}`;
  }

  goToPage(page: number): void {
    const next = (page + this.pageCount) % this.pageCount;
    if (next === this.page) return;
    this.page = next;
    this.apply();
    this.onLayout?.();
  }

  /** その文字が載っているページ。クイズで正解のページへ送るのに使う。 */
  pageOf(entry: KanaEntry): number {
    const rowIndex = KANA_ROWS.indexOf(entry.row);
    // 「ん」は最後のページにだけ居る
    if (rowIndex < 0) return this.pageCount - 1;
    return Math.floor(rowIndex / this.rowsPerPage);
  }

  /** その文字が見えるページへ移動する。 */
  reveal(entry: KanaEntry): void {
    this.goToPage(this.pageOf(entry));
  }

  cell(id: number): HTMLButtonElement | undefined {
    return this.cells.get(id);
  }

  /** アニメーションを掛け直す。連打されても必ず最初から再生されるようにする。 */
  flash(cell: HTMLButtonElement, effect: CellEffect): void {
    const cls = EFFECT_CLASS[effect];
    cell.classList.remove(...Object.values(EFFECT_CLASS));
    void cell.offsetWidth;
    cell.classList.add(cls);
    cell.addEventListener('animationend', () => cell.classList.remove(cls), { once: true });
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

  destroy(): void {
    this.portrait.removeEventListener('change', this.onOrientation);
  }
}
