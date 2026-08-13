import { audio } from './AudioEngine';

/**
 * 効果音は OscillatorNode で合成する。
 * 音声ファイルを増やさずに済み、オフラインでも必ず鳴る。
 */

interface ToneOptions {
  freq: number;
  /** 秒 */
  start: number;
  /** 秒 */
  duration: number;
  gain?: number;
  type?: OscillatorType;
}

function tone({ freq, start, duration, gain = 0.18, type = 'sine' }: ToneOptions): void {
  const ctx = audio.context;
  const out = audio.output;
  if (!ctx || !out) return;

  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  // クリックノイズを避けるため必ず立ち上がりと減衰をつける
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(env);
  env.connect(out);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** マスを触った瞬間の小さなポップ。 */
export function playTap(): void {
  tone({ freq: 880, start: 0, duration: 0.07, gain: 0.1 });
}

/** 正解。ド→ミ→ソ の上昇。 */
export function playCorrect(): void {
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    tone({ freq, start: i * 0.08, duration: 0.16, gain: 0.2 });
  });
}

/** 不正解。低すぎず、責める感じにならないやさしい 2 音。 */
export function playWrong(): void {
  tone({ freq: 392.0, start: 0, duration: 0.14, gain: 0.13, type: 'triangle' });
  tone({ freq: 329.63, start: 0.11, duration: 0.2, gain: 0.13, type: 'triangle' });
}

/** 1 セット終わったときのお祝い。 */
export function playFanfare(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => tone({ freq, start: i * 0.09, duration: 0.22, gain: 0.2 }));
  notes.forEach((freq, i) => {
    tone({ freq: freq * 1.5, start: 0.45 + i * 0.07, duration: 0.3, gain: 0.12 });
  });
  tone({ freq: 1567.98, start: 0.8, duration: 0.7, gain: 0.1 });
}
