import { CHARACTERS, KANA_ROWS, type KanaEntry } from '../data/characters';
import { withBase } from '../audio/AudioEngine';

export type CellEffect = 'pressed' | 'correct' | 'wrong';

/** 段の数 (あ・い・う・え・お)。 */
const DAN_COUNT = 5;

/**
 * これを下回ったらページ送りに切り替える 1 マスの一辺 (px)。
 * タブレット・PC は全 10 行を並べても 59〜87px 出るのでページ送りにならない。
 */
const PAGE_IF_BELOW = 58;
/** ページ送りするときに確保したい 1 マスの一辺 (px)。 */
const TARGET_WHEN_PAGING = 76;

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
 * 46 マスあると 10 行 x 5 段になり、スマホでは 1 マスが 44px を切って画面にも
 * 収まらない。そこで「1 マスが小さくなりすぎる画面では行を何ページかに分けて
 * 送る」ようにしている。何行ずつ見せるかは board-area の実寸から毎回計算する
 * ので、行が増えても端末が変わっても勝手に折り合いがつく。
 */
export class Board {
  /** board-area とページャをまとめた外枠。 */
  readonly el: HTMLDivElement;
  private area: HTMLDivElement;
  private grid: HTMLDivElement;
  private cells = new Map<number, HTMLButtonElement>();
  private rowOf = new Map<number, number>();

  private perPage = KANA_ROWS.length;
  private page = 0;
  private observer: ResizeObserver | null = null;

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

    this.observer = new ResizeObserver(() => this.relayout());
    this.observer.observe(this.area);
    this.relayout();
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

  /** その並びで 1 マスが何 px になるかを board.css と同じ式で見積もる。 */
  private cellSize(rows: number, w: number, h: number, gap: number, portrait: boolean): number {
    const cols = portrait ? rows : DAN_COUNT;
    const rowUnits = portrait ? DAN_COUNT + 0.6 : rows + 0.6;
    const rowGaps = portrait ? DAN_COUNT : rows;
    return Math.min(
      (w - (cols - 1) * gap) / cols,
      (h - rowGaps * gap) / rowUnits,
    );
  }

  /** 画面の実寸から「1 ページに何行載せるか」を決めて反映する。 */
  relayout(): void {
    const total = KANA_ROWS.length;
    const portrait = window.matchMedia('(orientation: portrait)').matches;
    const gap = parseFloat(getComputedStyle(this.grid).gap) || 8;

    // ページャを出すと board-area が縮むので、2 回まわして落ち着かせる。
    let perPage = total;
    for (let pass = 0; pass < 2; pass += 1) {
      const { width, height } = this.area.getBoundingClientRect();
      if (width < 1 || height < 1) return;

      if (this.cellSize(total, width, height, gap, portrait) >= PAGE_IF_BELOW) {
        perPage = total;
      } else {
        perPage = 1;
        for (let n = total; n >= 1; n -= 1) {
          if (this.cellSize(n, width, height, gap, portrait) >= TARGET_WHEN_PAGING) {
            perPage = n;
            break;
          }
        }
      }
      const changed = perPage !== this.perPage;
      this.perPage = perPage;
      this.el.classList.toggle('is-paged', perPage < total);
      if (!changed) break;
    }

    this.page = Math.min(this.page, this.pageCount - 1);
    this.apply();
    this.onLayout?.();
  }

  private apply(): void {
    const start = this.page * this.perPage;
    const end = Math.min(start + this.perPage, KANA_ROWS.length);
    // 端数ページでも枠は perPage ぶん確保する。そうしないと最後のページだけ
    // マスが急に大きくなり、めくるたびに表が伸び縮みして落ち着かない。
    // 五十音表は右から左に進むので、空くのは左側になる。
    const slots = this.perPage;
    this.grid.style.setProperty('--row-count', String(slots));

    for (const [id, cell] of this.cells) {
      const rowIndex = this.rowOf.get(id) ?? -1;
      if (rowIndex < 0) {
        // おまけの「ん」はどのページでも最下段に出しておく。
        cell.hidden = false;
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
    return Math.ceil(KANA_ROWS.length / this.perPage);
  }

  get currentPage(): number {
    return this.page;
  }

  get isPaged(): boolean {
    return this.perPage < KANA_ROWS.length;
  }

  /** そのページに含まれる行の名前 (ページャの見出し用)。 */
  pageLabel(page: number): string {
    const start = page * this.perPage;
    const rows = KANA_ROWS.slice(start, start + this.perPage);
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
    if (rowIndex < 0) return this.page; // 「ん」はどのページにも居る
    return Math.floor(rowIndex / this.perPage);
  }

  /** その文字が見えるページへ移動する。 */
  reveal(entry: KanaEntry): void {
    if (!this.isPaged) return;
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
    this.observer?.disconnect();
    this.observer = null;
  }
}
