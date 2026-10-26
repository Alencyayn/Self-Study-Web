let enabled = true;
try { enabled = localStorage.getItem('study-studio-sound') !== 'off'; } catch { /* Sound preferences can remain in memory. */ }
let context, animation;
export function soundEnabled() { return enabled; }
export function setSoundEnabled(value) {
  enabled = !!value;
  try { localStorage.setItem('study-studio-sound', enabled ? 'on' : 'off'); } catch { /* Optional preference. */ }
}
function chime() {
  if (!enabled) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    context ||= new Audio();
    context.resume().catch(() => {});
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      const start = context.currentTime + i * .12;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.075, start + .015);
      gain.gain.exponentialRampToValueAtTime(.001, start + .65);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(start); oscillator.stop(start + .7);
    });
  } catch { /* A blocked audio device must not interrupt completion. */ }
}
export function celebrate() {
  chime();
  const canvas = document.querySelector('#celebration');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  cancelAnimationFrame(animation);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr); canvas.hidden = false;
  const colors = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'];
  const particles = Array.from({ length: reduced ? 55 : 180 }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * 100, vy: 90 + Math.random() * 130, size: 7 + Math.random() * 8, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 8, color: colors[Math.floor(Math.random() * colors.length)] }));
  const start = performance.now();
  let previous = start;
  function frame(now) {
    const elapsed = now - start, dt = Math.min((now - previous) / 1000, .04); previous = now;
    ctx.clearRect(0, 0, w, h);
    if (elapsed > (reduced ? 1300 : 4100)) { canvas.hidden = true; return; }
    ctx.globalAlpha = elapsed > 3000 ? Math.max(0, (4100 - elapsed) / 1100) : 1;
    for (const p of particles) {
      if (!reduced) { p.x += p.vx * dt; p.y += p.vy * dt; p.rotation += p.spin * dt; p.vy += 13 * dt; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 + Math.sin(p.rotation) * 2); ctx.restore();
    }
    animation = requestAnimationFrame(frame);
  }
  animation = requestAnimationFrame(frame);
}
