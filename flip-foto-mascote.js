(() => {
  document.querySelectorAll('.fm-story:not([data-ready])').forEach(root => {
    root.dataset.ready = '';
    const slides = [...root.querySelectorAll('.fm-story__slide')];
    const dots = [...root.querySelectorAll('.fm-story__dot')];
    const toggle = root.querySelector('.fm-story__toggle');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const cycle = Math.max(2500, Number(root.dataset.cycle) || 6000);
    root.style.setProperty('--fm-cycle', cycle + 'ms');
    let current = 0, timer = null, started = 0, remaining = cycle;
    let visible = true, ready = false, manuallyPaused = false;
    const pauseButton = root.querySelector('[data-fm-pause]');
    const canPlay = () => ready && visible && !document.hidden && !motion.matches && !manuallyPaused;
    function stop() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
        remaining = Math.max(0, remaining - (performance.now() - started));
      }
    }
    function update() {
      if (!canPlay()) {
        stop();
        root.setAttribute('data-paused', '');
      } else {
        root.removeAttribute('data-paused');
        if (timer === null) {
          started = performance.now();
          timer = setTimeout(() => {
            timer = null;
            select((current + 1) % slides.length);
          }, remaining);
        }
      }
    }
    function select(index) {
      stop();
      current = index;
      remaining = cycle;
      root.removeAttribute('data-show-mascot');
      toggle.textContent = 'Ver mascote';
      slides.forEach((slide, i) => {
        slide.classList.toggle('is-active', i === index);
        slide.setAttribute('aria-hidden', String(i !== index));
      });
      dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === index)));
      update();
    }
    dots.forEach((dot, i) => dot.addEventListener('click', () => {
      if (i !== current) select(i);
    }));
    toggle.addEventListener('click', () => {
      const showing = root.toggleAttribute('data-show-mascot');
      toggle.textContent = showing ? 'Ver foto' : 'Ver mascote';
    });
    if (pauseButton) pauseButton.addEventListener('click', () => {
      manuallyPaused = !manuallyPaused;
      pauseButton.textContent = manuallyPaused ? 'Continuar' : 'Pausar';
      pauseButton.setAttribute('aria-pressed', String(manuallyPaused));
      update();
    });
    document.addEventListener('visibilitychange', update);
    const motionChanged = () => {
      if (pauseButton) pauseButton.hidden = motion.matches;
      remaining = cycle; select(current);
    };
    if (pauseButton) pauseButton.hidden = motion.matches;
    if (motion.addEventListener) motion.addEventListener('change', motionChanged);
    else motion.addListener(motionChanged);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        update();
      }).observe(root);
    }
    update();
    Promise.all([...root.querySelectorAll('img')].map(img =>
      img.decode ? img.decode().catch(() => {}) : Promise.resolve()
    )).then(() => { ready = true; update(); });
  });
})();
