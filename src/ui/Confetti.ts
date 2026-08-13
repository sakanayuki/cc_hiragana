const COLORS = ['#F0A389', '#86CEB4', '#F0C85C', '#8FB8E8', '#E79FC4'];

const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * 紙吹雪。Web Animations API で撒くだけなので後片付けが要らない。
 */
export class Confetti {
  readonly el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'confetti';
    this.el.setAttribute('aria-hidden', 'true');
  }

  /**
   * @param count 枚数
   * @param origin 0..1 の相対座標。省略時は画面上部から降らせる。
   */
  burst(count = 24, origin?: { x: number; y: number }): void {
    if (prefersReducedMotion()) return;

    const { width, height } = this.el.getBoundingClientRect();
    if (!width || !height) return;

    for (let i = 0; i < count; i += 1) {
      const bit = document.createElement('i');
      bit.className = 'confetti__bit';
      bit.style.background = COLORS[i % COLORS.length]!;

      const startX = origin ? origin.x * width : Math.random() * width;
      const startY = origin ? origin.y * height : -20;
      bit.style.left = `${startX}px`;
      bit.style.top = `${startY}px`;
      this.el.append(bit);

      const drift = (Math.random() - 0.5) * width * 0.7;
      const fall = height * (origin ? 0.7 : 1.1) + Math.random() * height * 0.2;
      const duration = 1100 + Math.random() * 900;
      const spin = 360 + Math.random() * 720;

      const anim = bit.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
          {
            transform: `translate(${drift}px, ${fall}px) rotate(${spin}deg)`,
            opacity: 0,
          },
        ],
        { duration, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)', fill: 'forwards' },
      );
      anim.onfinish = () => bit.remove();
    }
  }

  clear(): void {
    this.el.replaceChildren();
  }
}
