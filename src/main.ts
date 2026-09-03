import './styles/base.css';
import './styles/board.css';
import './styles/screens.css';
import './styles/pager.css';
import './styles/mode-switch.css';
import './styles/motion.css';

import { registerSW } from 'virtual:pwa-register';
import { FreeMode } from './ui/FreeMode';
import { ModeSwitch, type Mode } from './ui/ModeSwitch';
import { QuizMode } from './ui/QuizMode';
import { StartScreen } from './ui/StartScreen';

interface Screen {
  readonly el: HTMLElement;
  destroy(): void;
}

const app = document.getElementById('app');
if (!app) throw new Error('#app が見つかりません');

let mode: Mode = 'free';
let screen: Screen | null = null;

function show(next: Mode): void {
  screen?.destroy();
  mode = next;
  screen = next === 'quiz' ? new QuizMode() : new FreeMode();
  app!.append(screen.el);
}

const modeSwitch = new ModeSwitch(
  () => mode,
  (next) => show(next),
);

const start = new StartScreen(() => {
  start.el.remove();
  show('free');
  app.append(modeSwitch.el);
  void keepAwake();
});

app.append(start.el);

/* ---- 子ども防御 -------------------------------------------------------
 * ここを外すと、遊んでいる最中に画面が拡大したり選択ハンドルが出たりして
 * 3歳児が自力で戻れなくなる。
 * -------------------------------------------------------------------- */

// 長押しメニュー
document.addEventListener('contextmenu', (ev) => ev.preventDefault());

// iOS Safari のピンチズーム（viewport の user-scalable だけでは止まらない）
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (ev) => ev.preventDefault(), { passive: false });
}

// 2 本指以上で触られたときのスクロール・ズーム
document.addEventListener(
  'touchmove',
  (ev) => {
    if (ev.touches.length > 1) ev.preventDefault();
  },
  { passive: false },
);

// ドラッグで絵を持ち出せてしまうのを止める
document.addEventListener('dragstart', (ev) => ev.preventDefault());

/** 遊んでいる最中に画面が消えないようにする。対応していない端末では黙って諦める。 */
async function keepAwake(): Promise<void> {
  const wakeLock = navigator.wakeLock;
  if (!wakeLock) return;

  let sentinel: WakeLockSentinel | null = null;
  const acquire = async (): Promise<void> => {
    try {
      sentinel = await wakeLock.request('screen');
    } catch {
      // バッテリー低下時などは拒否される。実害はないので無視。
    }
  };

  await acquire();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && sentinel?.released !== false) void acquire();
  });
}

// 新しい版が出ていたら次に開いたときに差し替わる
registerSW({ immediate: true });
