import { QUIZ_POOL, QUIZ_SET_SIZE, type KanaEntry } from '../data/characters';
import { audio } from '../audio/AudioEngine';
import { playCorrect, playFanfare, playWrong } from '../audio/sfx';
import { Board } from './Board';
import { Confetti } from './Confetti';
import { Pager } from './Pager';

/** 2 回まちがえたら正解のマスをそっと光らせる。 */
const HINT_AFTER_MISSES = 2;
const NEXT_QUESTION_DELAY = 900;

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * クイズモード。
 *
 * 出題は「大きなかな」＋「ことばの音声」。表は自由タップと同じものなので、
 * 遊びの延長で探せる。「ん」(うんち) と「を」(えをかく) は文字と音の頭が
 * そろわないため出題対象から外してあるが、マスとしては触れる（ハズレ扱い）。
 *
 * まちがえても減点もやり直しもしない。何度でも触れる。
 */
export class QuizMode {
  readonly el: HTMLDivElement;
  private board: Board;
  private pager: Pager;
  private confetti = new Confetti();
  private charEl: HTMLDivElement;
  private pipsEl: HTMLDivElement;
  private celebrateEl: HTMLDivElement | null = null;

  private queue: KanaEntry[] = [];
  private current: KanaEntry | null = null;
  private answered = 0;
  private misses = 0;
  private timers = new Set<number>();

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'screen quiz';

    const prompt = document.createElement('div');
    prompt.className = 'quiz__prompt';

    const label = document.createElement('span');
    label.className = 'quiz__label';
    label.textContent = 'これ どれ？';

    this.charEl = document.createElement('div');
    this.charEl.className = 'quiz__char';
    this.charEl.setAttribute('aria-live', 'polite');

    const replay = document.createElement('button');
    replay.type = 'button';
    replay.className = 'quiz__replay';
    replay.textContent = '🔊';
    replay.setAttribute('aria-label', 'もういちど きく');
    replay.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      if (this.current) audio.speak(this.current);
    });

    prompt.append(label, this.charEl, replay);

    this.pipsEl = document.createElement('div');
    this.pipsEl.className = 'quiz__pips';

    this.board = new Board((entry, cell) => this.answer(entry, cell));

    this.pager = new Pager(this.board);
    this.board.el.append(this.pager.el);
    this.board.onLayout = () => this.pager.render();

    this.el.append(prompt, this.board.el, this.pipsEl, this.confetti.el);
    this.startSet();
  }

  private startSet(): void {
    this.celebrateEl?.remove();
    this.celebrateEl = null;
    this.confetti.clear();
    this.board.clearEffects();
    this.board.setInteractive(true);

    // 出題できる 44 文字から重複なしで 5 問取る
    this.queue = shuffled(QUIZ_POOL).slice(0, QUIZ_SET_SIZE);
    this.answered = 0;
    this.renderPips();
    this.nextQuestion();
  }

  private renderPips(): void {
    const pips = Array.from({ length: QUIZ_SET_SIZE }, (_, i) => {
      const pip = document.createElement('span');
      pip.className = 'quiz__pip';
      pip.classList.toggle('is-done', i < this.answered);
      return pip;
    });
    this.pipsEl.replaceChildren(...pips);
  }

  private nextQuestion(): void {
    const next = this.queue.shift();
    if (!next) {
      this.celebrate();
      return;
    }

    this.current = next;
    this.misses = 0;
    this.board.setHint(null);
    // ページ送り中は正解が別のページに居ることがあるので、その行まで送る。
    // 1 ページに 20 マス前後あるので、これだけでは答えは割れない。
    this.board.reveal(next);

    this.charEl.textContent = next.kana;
    this.charEl.classList.remove('is-changing');
    void this.charEl.offsetWidth;
    this.charEl.classList.add('is-changing');

    // 今の素材は「かめ」のようなことばだけ。かな 1 音の mp3 を後から足したら
    // ここで「か」→「かめ」の順に鳴らすように広げられる (KanaEntry.kanaAudio)。
    audio.speak(next);
  }

  private answer(entry: KanaEntry, cell: HTMLButtonElement): void {
    const target = this.current;
    if (!target) return;

    if (entry.id === target.id) {
      this.board.setInteractive(false);
      this.board.setHint(null);
      this.board.flash(cell, 'correct');
      playCorrect();

      const rect = cell.getBoundingClientRect();
      const host = this.confetti.el.getBoundingClientRect();
      this.confetti.burst(18, {
        x: (rect.left + rect.width / 2 - host.left) / host.width,
        y: (rect.top + rect.height / 2 - host.top) / host.height,
      });

      this.answered += 1;
      this.renderPips();
      this.later(() => {
        this.board.setInteractive(true);
        this.nextQuestion();
      }, NEXT_QUESTION_DELAY);
      return;
    }

    // はずれ。責めない・進まない・何度でも触れる。
    this.board.flash(cell, 'wrong');
    playWrong();
    this.misses += 1;
    if (this.misses >= HINT_AFTER_MISSES) {
      // ヒントのマスが見えていないと意味がないので、そのページへ送る
      this.board.reveal(target);
      this.board.setHint(target.id);
    }
  }

  private celebrate(): void {
    this.current = null;
    this.board.setInteractive(false);
    this.board.setHint(null);
    playFanfare();
    this.confetti.burst(60);

    const screen = document.createElement('div');
    screen.className = 'screen celebrate';

    const title = document.createElement('div');
    title.className = 'celebrate__title';
    title.textContent = 'よくできました！';

    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'celebrate__again';
    again.textContent = 'もういっかい';
    again.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      this.startSet();
    });

    screen.append(title, again);
    this.celebrateEl = screen;
    this.el.append(screen);
  }

  private later(fn: () => void, ms: number): void {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  destroy(): void {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    audio.stopVoice();
    this.board.destroy();
    this.el.remove();
  }
}
