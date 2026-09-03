import { CHARACTERS, KANA_ROWS, type KanaEntry } from '../data/characters';
import { withBase } from '../audio/AudioEngine';

export type CellEffect = 'pressed' | 'correct' | 'wrong';

/** 段の数 (あ・い・う・え・お)。 */
const DAN_COUNT = 5;

/**
 * 1 ページに載せる行の数。
 * あ・か・さ・た・な で 1 ページ、は・ま・や・ら・わ で 1 ページの 2 ページ構成。
 * 端末によらず固定なので、どの画面でも同じ見え方・同じめくり方になる。
 */
const ROWS_PER_PAGE = 5;

const EFFECT_CLASS: Record<CellEffect, string> = {
  pressed: 'is-pressed',
  correct: 'is-correct',
  wrong: 'is-wrong',
};

/**
 * 五十音表そのもの。自由タップモードとクイズモードで同じものを使う。
 *
 * 並びは CSS 側 (board.css) のメディアクエリが決める。各マスに縦持ち用と
 * 横長用の座標を両方持たせてあるので、端末を回した瞬間に JS を介さず並び替わる。
 *
 * 46 マスを 1 画面に並べるとマスが小さくなりすぎるので、行を 2 ページに分けて
 * 送る。1 ページ目が あ・か・さ・た・な、2 ページ目が は・ま・や・ら・わ。
 * おまけの「ん」は 2 ページ目 (最後のページ) にだけ置く。
 */
export class Board {
  /** board-area とページャをまとめた外枠。 */
  readonly el: HTMLDivElement;
  private area: HTMLDivElement;
  private grid: HTMLDivElement;
  private cells = new Map<number, HTMLButtonElement>();
  private rowOf = new Map<number, number>();

  private page = 0;

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

    // 1 ページの行数は固定なので、列数もここで決まりきる。
    // 向きによる並び替えは CSS のメディアクエリだけで完結する。
    this.grid.style.setProperty('--row-count', String(ROWS_PER_PAGE));
    this.apply();
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
    const start = this.page * ROWS_PER_PAGE;
    const end = Math.min(start + ROWS_PER_PAGE, KANA_ROWS.length);
    const slots = ROWS_PER_PAGE;
    const lastPage = this.page === this.pageCount - 1;

    for (const [id, cell] of this.cells) {
      const rowIndex = this.rowOf.get(id) ?? -1;
      if (rowIndex < 0) {
        // おまけの「ん」は最後のページ (は〜わ) の最下段にだけ置く。
        cell.hidden = !lastPage;
        cell.style.setProperty('--p-row', String(DAN_COUNT + 1));
        cell.style.setProperty('--l-col', '3');
        cell.style.setProperty('--l-row', String(slots + 1));
        continue;
      }
      const within = rowIndex >= start && rowIndex < end;
      cell.hidden = !within;
      if (!within) continue;
      const offset = rowIndex - start;
      // 縦持ち: 五十音表と同じく右の列から あ行 → か行 → …。段が行になる。
      cell.style.setProperty('--p-col', String(slots - offset));
      cell.style.setProperty('--p-row', String((this.entryCol(id) ?? 0) + 1));
      // 横長: 素材画像と同じ横並び。行がそのまま行になる。
      cell.style.setProperty('--l-col', String((this.entryCol(id) ?? 0) + 1));
      cell.style.setProperty('--l-row', String(offset + 1));
    }
  }

  private entryCol(id: number): number | undefined {
    return CHARACTERS.find((c) => c.id === id)?.col;
  }

  get pageCount(): number {
    return Math.ceil(KANA_ROWS.length / ROWS_PER_PAGE);
  }

  get currentPage(): number {
    return this.page;
  }

  /** そのページに含まれる行の名前 (ページャの見出し用)。 */
  pageLabel(page: number): string {
    const start = page * ROWS_PER_PAGE;
    const rows = KANA_ROWS.slice(start, start + ROWS_PER_PAGE);
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
    return Math.floor(rowIndex / ROWS_PER_PAGE);
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
    // 監視しているものは無い。呼び出し側の後始末をそろえるために残してある。
  }
}
