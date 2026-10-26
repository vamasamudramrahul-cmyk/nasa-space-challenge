// Decorative starfield for Home screen-1. Does not control page scrolling or other screens.
const HeroStarfield = (() => {
  let frame = 0;
  let handleResize = null;

  function init() {
    const canvas = document.querySelector('.universe #stars');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars = [];
    let width = 0;
    let height = 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function createStars() {
      stars = Array.from({ length: Math.min(450, Math.floor(width * height / 1800)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.4 + 0.2,
        alpha: Math.random() * 0.8 + 0.2,
        speed: Math.random() * 0.012 + 0.003,
        phase: Math.random() * Math.PI * 2,
        drift: Math.random() * 0.12 + 0.02
      }));
    }

    function resizeCanvas() {
      if (frame) { window.cancelAnimationFrame(frame); frame = 0; }
      width = canvas.clientWidth || window.innerWidth;
      height = canvas.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      createStars();
      drawStars(0);
    }

    function drawStars(timestamp) {
      ctx.clearRect(0, 0, width, height);
      const time = timestamp * 0.001;
      for (const s of stars) {
        const twinkle = reduceMotion ? 0.75 : 0.35 + 0.65 * (Math.sin(time * s.speed * 60 + s.phase) + 1) / 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,232,255,${s.alpha * twinkle})`;
        ctx.fill();
        if (!reduceMotion && (s.y += s.drift) > height) { s.y = 0; s.x = Math.random() * width; }
      }
      if (!reduceMotion) frame = window.requestAnimationFrame(drawStars);
    }

    if (handleResize) {
      window.removeEventListener('resize', handleResize);
    }
    handleResize = resizeCanvas;
    window.addEventListener('resize', handleResize, { passive: true });
    resizeCanvas();

    if (reduceMotion && frame) {
      window.cancelAnimationFrame(frame);
    }
  }

  function destroy() {
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
    if (handleResize) {
      window.removeEventListener('resize', handleResize);
      handleResize = null;
    }
  }

  return { init, destroy };
})();

window.HeroStarfield = HeroStarfield;
