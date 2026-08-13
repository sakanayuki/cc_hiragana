import { CHARACTERS, type KanaEntry } from '../data/characters';

/**
 * Web Audio API での再生。HTML の <audio> は使わない。
 *
 * - <audio> は再生開始までの遅れが大きく、3歳児には「押しても鳴らない」と感じられる
 * - iOS では要素ごとにアンロックが要る
 * - 連打時に前の音を確実に止められない
 *
 * のいずれもタップおもちゃとしては致命的なため。
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voice: AudioBufferSourceNode | null = null;

  /** ユーザー操作の中で呼ぶこと。iOS のオーディオアンロックはここで済ませる。 */
  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio API が使えません');

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;

    if (ctx.state === 'suspended') await ctx.resume();

    // 無音を 1 発鳴らして iOS のアンロックを確定させる
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    silent.connect(master);
    silent.start(0);
  }

  /** 11 ファイルまとめて取得・デコードする。合計 100KB 程度なので一括で問題ない。 */
  async preload(onProgress?: (done: number, total: number) => void): Promise<void> {
    const ctx = this.requireCtx();
    const sources = [...new Set(CHARACTERS.map((c) => c.audio))];
    let done = 0;
    onProgress?.(0, sources.length);

    await Promise.all(
      sources.map(async (src) => {
        try {
          const res = await fetch(withBase(src));
          if (!res.ok) throw new Error(`${res.status} ${src}`);
          this.buffers.set(src, await ctx.decodeAudioData(await res.arrayBuffer()));
        } catch (err) {
          // 1 つ落ちてもアプリは起動させる。その文字だけ無音になる。
          console.warn('音声の読み込みに失敗:', src, err);
        } finally {
          done += 1;
          onProgress?.(done, sources.length);
        }
      }),
    );
  }

  get loadedCount(): number {
    return this.buffers.size;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  get output(): GainNode | null {
    return this.master;
  }

  /**
   * ことばを鳴らす。連打されたら前の音を止めて即座に鳴らし直す。
   * 待たせない・重ねないのが 3歳児のタップおもちゃとして正しい挙動。
   */
  speak(entry: KanaEntry): void {
    const ctx = this.ctx;
    const master = this.master;
    const buffer = this.buffers.get(entry.audio);
    if (!ctx || !master || !buffer) return;

    this.stopVoice();
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(master);
    node.onended = () => {
      if (this.voice === node) this.voice = null;
    };
    node.start(0);
    this.voice = node;
  }

  stopVoice(): void {
    if (!this.voice) return;
    try {
      this.voice.onended = null;
      this.voice.stop();
    } catch {
      // すでに終わっていた場合は無視
    }
    this.voice = null;
  }

  private requireCtx(): AudioContext {
    if (!this.ctx) throw new Error('unlock() を先に呼ぶこと');
    return this.ctx;
  }
}

/** Vite の base (GitHub Pages では /cc_hiragana/) を前置きする。 */
export function withBase(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`.replace(/([^:])\/{2,}/g, '$1/');
}

export const audio = new AudioEngine();
