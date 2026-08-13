import { audio } from '../audio/AudioEngine';

/**
 * 最初の 1 タップを受け取る画面。
 *
 * iOS は必ずユーザー操作の中でしか AudioContext を動かせないので、
 * この 1 タップでアンロックと音声のプリロードを済ませてしまう。
 */
export class StartScreen {
  readonly el: HTMLDivElement;
  private button: HTMLButtonElement;
  private dots: HTMLSpanElement[] = [];

  constructor(private onReady: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'screen start';

    const title = document.createElement('h1');
    title.className = 'start__title';
    title.textContent = 'あいうえお';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'start__button';
    this.button.textContent = '▶ はじめる';

    const progress = document.createElement('div');
    progress.className = 'start__progress';

    this.el.append(title, this.button, progress);
    this.button.addEventListener('click', () => void this.start(progress), { once: true });
  }

  private async start(progress: HTMLDivElement): Promise<void> {
    this.button.disabled = true;
    this.button.textContent = 'よみこみちゅう';

    try {
      await audio.unlock();
    } catch (err) {
      // 音が出せない端末でも表は触れるようにする
      console.warn('オーディオを開始できませんでした:', err);
      this.onReady();
      return;
    }

    await audio.preload((done, total) => {
      if (this.dots.length !== total) {
        this.dots = Array.from({ length: total }, () => {
          const dot = document.createElement('span');
          dot.className = 'start__dot';
          return dot;
        });
        progress.replaceChildren(...this.dots);
      }
      this.dots.forEach((dot, i) => dot.classList.toggle('is-on', i < done));
    });

    this.onReady();
  }
}
