/**
 * A dependency-free canvas confetti burst. CONSTRAINTS.md §2 fixes the
 * runtime budget at react + react-dom, so the celebration is a hand-rolled
 * rAF loop on a throwaway canvas: no library, and the canvas removes
 * itself when the burst ends. Reduced motion skips the burst entirely —
 * the level-up toast still announces the achievement.
 */

const DURATION_MS = 2600;
const PARTICLE_COUNT = 140;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  colour: string;
  shape: 'rect' | 'circle';
}

/** The Y2K hues, read from the theme so the burst matches both modes. */
function burstColours(): string[] {
  const fallback = ['#7c5cff', '#00b8d9', '#12b886', '#e6499a'];
  try {
    const styles = getComputedStyle(document.documentElement);
    const hues = ['--hue-a', '--hue-b', '--hue-c', '--hue-d'].map((name) =>
      styles.getPropertyValue(name).trim(),
    );
    return hues.every((hue) => hue !== '') ? hues : fallback;
  } catch {
    return fallback;
  }
}

export function fireConfetti(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  // jsdom and older browsers expose no 2d context; the burst is cosmetic.
  if (!context) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.cssText = `position:fixed;inset:0;width:${width}px;height:${height}px;pointer-events:none;z-index:60;`;
  document.body.appendChild(canvas);
  context.scale(ratio, ratio);

  const colours = burstColours();
  const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => {
    // Two fountains from the bottom corners, aimed at the middle.
    const fromLeft = Math.random() < 0.5;
    const angle = fromLeft
      ? -Math.PI / 2 - Math.random() * 0.9
      : -Math.PI / 2 + Math.random() * 0.9;
    const speed = 9 + Math.random() * 7;
    return {
      x: fromLeft ? width * 0.08 : width * 0.92,
      y: height + 10,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 5,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      colour: colours[(Math.random() * colours.length) | 0],
      shape: Math.random() < 0.5 ? 'rect' : 'circle',
    };
  });

  const start = performance.now();
  const tick = (now: number) => {
    const elapsed = now - start;
    context.clearRect(0, 0, width, height);
    for (const particle of particles) {
      particle.vy += 0.18; // gravity
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.rotation += particle.spin;
      const age = elapsed / DURATION_MS;
      // Hold full opacity for most of the burst, then fade out.
      context.globalAlpha = age < 0.7 ? 1 : 1 - (age - 0.7) / 0.3;
      context.fillStyle = particle.colour;
      if (particle.shape === 'rect') {
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.fillRect(
          -particle.size / 2,
          -particle.size / 2,
          particle.size,
          particle.size * 0.6,
        );
        context.restore();
      } else {
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;

    if (elapsed < DURATION_MS) {
      window.requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  };
  window.requestAnimationFrame(tick);
}
