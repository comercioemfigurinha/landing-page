/* Atalhos do início e carrossel de avaliações. Sem bibliotecas adicionais. */
(() => {
  document.querySelectorAll('[data-select-plan]').forEach(link => {
    link.addEventListener('click', event => {
      const plan = link.dataset.selectPlan;
      const input = [...document.querySelectorAll('input[name="estiloRadio"]')]
        .find(item => item.value === plan);
      if (!input || typeof goTo !== 'function') return;
      event.preventDefault();
      input.checked = true;
      // Reutiliza a lógica existente: campos obrigatórios, resumo e plano persistido.
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof CEF !== 'undefined') CEF.setProgress({ estilo: true });
      // Personalizado vai aos dados; pronto precisa escolher um modelo primeiro.
      goTo(plan === 'Personalizado' ? 2 : 1, false);
    });
  });

  const track = document.querySelector('#reviewGrid');
  if (!track) return;
  const cards = [...track.querySelectorAll('.v2-review')];
  const carousel = track.closest('.v2-review-carousel');
  const dotsContainer = carousel.querySelector('.v2-review-dots');
  const previous = carousel.querySelector('[data-review-prev]');
  const next = carousel.querySelector('[data-review-next]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  const dots = cards.map((card, index) => {
    card.setAttribute('aria-label', `Avaliação ${index + 1} de ${cards.length}`);
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'v2-review-dot';
    dot.setAttribute('aria-label', `Mostrar avaliação ${index + 1}`);
    dot.setAttribute('aria-controls', 'reviewGrid');
    dot.addEventListener('click', () => go(index));
    dotsContainer.appendChild(dot);
    return dot;
  });
  const position = index => cards[index].offsetLeft - cards[0].offsetLeft;
  function update() {
    dots.forEach((dot, index) => dot.setAttribute('aria-pressed', String(index === current)));
    previous.disabled = current === 0;
    next.disabled = current === cards.length - 1;
  }
  function go(index) {
    if (!cards.length) return;
    current = Math.max(0, Math.min(index, cards.length - 1));
    track.scrollTo({ left: position(current), behavior: motion.matches ? 'instant' : 'smooth' });
    update();
  }
  previous.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  let queued = false;
  track.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      let distance = Infinity;
      cards.forEach((card, index) => {
        const delta = Math.abs(position(index) - track.scrollLeft);
        if (delta < distance) { distance = delta; current = index; }
      });
      update();
    });
  }, { passive: true });
  track.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    go(current + (event.key === 'ArrowRight' ? 1 : -1));
  });
  // Mantém o card alinhado ao mudar a largura ou girar o celular.
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      if (cards.length) track.scrollTo({ left: position(current), behavior: 'instant' });
    }).observe(track);
  }
  carousel.querySelector('.v2-review-controls').hidden = cards.length < 2;
  update();
})();
