const form = document.querySelector('#leadForm');
const steps = [...document.querySelectorAll('.form-step')];
const nextBtn = document.querySelector('#nextBtn'), backBtn = document.querySelector('#backBtn');
const progressFill = document.querySelector('#progressFill'), stepLabel = document.querySelector('#stepLabel');
const whatsapp = document.querySelector('#whatsapp');
const estiloField = document.querySelector('#estiloField');
let current = 0;

// UserId único desta visita: nasce na etapa 1 e é reaproveitado até o checkout,
// assim a mesma linha da planilha vai sendo atualizada (sem duplicar).
let userId = null;

// Registra no admin até onde a pessoa chegou (etapa 1, 2 ou 3).
// Não bloqueia a navegação: se falhar, o formulário segue normalmente.
function salvarEtapa(etapa) {
  const cfg = window.SHEETS_CONFIG || {};
  if (!cfg.scriptUrl || String(cfg.scriptUrl).includes('COLE_')) return;
  if (!userId) userId = CEF.gerarUserId();
  const fd = new FormData();
  fd.append('acao', 'criar_lead');
  fd.append('Etapa', String(etapa));
  fd.append('UserId', userId);
  fd.append('Nome', form.Nome.value);
  fd.append('Comercio', form.Comercio.value);
  fd.append('WhatsApp', form.WhatsApp.value);
  fd.append('Estilo', estiloField.value);
  try { fetch(cfg.scriptUrl, { method: 'POST', body: fd, keepalive: true }).catch(() => {}); } catch {}
}

function showStep() {
  steps.forEach((s, i) => s.classList.toggle('active', i === current));
  progressFill.style.width = `${(current + 1) / steps.length * 100}%`;
  stepLabel.textContent = `${current + 1} de ${steps.length}`;
  backBtn.hidden = current === 0;
  nextBtn.hidden = current === steps.length - 1;
  if (current === steps.length - 1) review();
}

function validStep() {
  const fields = [...steps[current].querySelectorAll('input[required]')];
  const grupos = new Set();
  for (const f of fields) {
    if (f.type === 'radio') { grupos.add(f.name); continue; }
    if (!f.checkValidity()) { f.reportValidity(); return false; }
  }
  for (const nome of grupos) {
    if (!steps[current].querySelector(`input[name="${nome}"]:checked`)) {
      alert('Escolha um estilo para continuar.');
      return false;
    }
  }
  return true;
}

// Troca de etapa. Com flip=true faz uma leve virada 3D entre a etapa atual e a próxima.
// Depois da troca, rola até o início da etapa ativa (assim ela não sai do campo de visão).
function goTo(n, flip) {
  const swap = () => {
    current = n;
    showStep();
    steps[current].scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  if (!flip) { swap(); return; }
  const saindo = steps[current];
  saindo.classList.add('flip-out');
  setTimeout(() => {
    saindo.classList.remove('flip-out');
    swap();
    const entrando = steps[current];
    entrando.classList.add('flip-in');
    setTimeout(() => entrando.classList.remove('flip-in'), 400);
  }, 230);
}

nextBtn.addEventListener('click', () => {
  if (!validStep()) return;
  if (current === 0) { CEF.setProgress({ dados: true }); salvarEtapa(1); }
  if (current === 1) {
    CEF.setProgress({ estilo: true });
    salvarEtapa(2);
    // Meta Pixel: evento padrão "Adicionar à lista de desejos" (AddToWishlist), disparado ao clicar
    // em "Continuar" na etapa 2 (escolha do estilo). Usado como sinal de pré-cadastro.
    try { if (typeof fbq === 'function') fbq('track', 'AddToWishlist', { content_name: 'PreCadastro', content_category: estiloField.value }); } catch {}
  }
  const proximo = Math.min(current + 1, steps.length - 1);
  goTo(proximo, proximo === steps.length - 1); // flip só na entrada do checklist
});
backBtn.addEventListener('click', () => goTo(Math.max(0, current - 1), false));

whatsapp.addEventListener('input', e => {
  let v = e.target.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10) v = v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  else if (v.length > 6) v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  else if (v.length > 2) v = v.replace(/(\d{2})(\d+)/, '($1) $2');
  e.target.value = v;
});

// ---- Escolha de estilo ----
document.querySelectorAll('.style-card input').forEach(input => {
  input.addEventListener('change', () => {
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
    input.closest('.style-card').classList.add('selected');
    estiloField.value = input.value;
  });
});

// ---- Exemplos (carrossel clicável) ----
const examplesStrip = document.querySelector('#examplesStrip');
const examplesToggle = document.querySelector('#examplesToggle');
const exTrack = document.querySelector('#exTrack');
const exSlides = [...exTrack.children];
const exDots = document.querySelector('#exDots');
const exPrev = document.querySelector('#exPrev');
const exNext = document.querySelector('#exNext');

function setExamples(open) {
  examplesStrip.classList.toggle('open', open);
  examplesToggle.textContent = open ? 'Ver menos exemplos' : 'Clique para ver exemplos';
  if (open) exTrack.scrollTo({ left: 0 });
}
examplesToggle.addEventListener('click', () => setExamples(!examplesStrip.classList.contains('open')));

function goToSlide(i) {
  const s = exSlides[Math.max(0, Math.min(i, exSlides.length - 1))];
  exTrack.scrollTo({ left: s.offsetLeft - (exTrack.clientWidth - s.offsetWidth) / 2, behavior: 'smooth' });
}
function currentSlide() {
  const centro = exTrack.scrollLeft + exTrack.clientWidth / 2;
  let idx = 0, menor = Infinity;
  exSlides.forEach((s, i) => {
    const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - centro);
    if (d < menor) { menor = d; idx = i; }
  });
  return idx;
}
function updateCarousel() {
  const idx = currentSlide();
  [...exDots.children].forEach((d, i) => d.classList.toggle('active', i === idx));
  exPrev.disabled = idx === 0;
  exNext.disabled = idx === exSlides.length - 1;
}
exSlides.forEach((_, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', `Ir para o exemplo ${i + 1}`);
  b.addEventListener('click', () => goToSlide(i));
  exDots.appendChild(b);
});
exPrev.addEventListener('click', () => goToSlide(currentSlide() - 1));
exNext.addEventListener('click', () => goToSlide(currentSlide() + 1));
exTrack.addEventListener('scroll', () => requestAnimationFrame(updateCarousel), { passive: true });
updateCarousel();

// Clique no exemplo: seleciona o estilo, recolhe os exemplos e leva o olho até o "Continuar"
exTrack.addEventListener('click', e => {
  const hit = e.target.closest('.ex-hit');
  if (!hit) return;
  const radio = document.querySelector(`input[name="estiloRadio"][value="${hit.dataset.estilo}"]`);
  if (!radio) return;
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true })); // reaproveita o handler que marca o card e preenche o estiloField
  setExamples(false);
  // setTimeout(() => nextBtn.scrollIntoView({ behavior: 'smooth', block: 'center' }), 380);
});

// ---- FAQ ----
document.querySelectorAll('.faq-item').forEach(item => {
  item.querySelector('.faq-q').addEventListener('click', () => item.classList.toggle('open'));
});

function review() {
  const estiloTxt = estiloField.value === 'Mascote' ? 'com mascote' : 'só a logo';
  document.querySelector('#summaryLine').textContent = `${form.Comercio.value} · ${estiloTxt} · R$ 47,00`;
  // Só agora o checklist aparece: nome/telefone e estilo já riscados.
  CEF.renderTracker(document.querySelector('#trackerBox'), ['dados', 'estilo']);
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const cfg = window.SHEETS_CONFIG || {};
  const missing = !cfg.scriptUrl || String(cfg.scriptUrl).includes('COLE_');
  if (missing) { alert('O envio ainda não foi configurado. Cole a URL do Apps Script em js/sheets-config.js.'); return; }

  if (!userId) userId = CEF.gerarUserId();
  const nome = form.Nome.value, comercio = form.Comercio.value, whatsappVal = form.WhatsApp.value, estilo = estiloField.value;

  CEF.showLoading([
    'Preparando seu pedido...',
    'Isso pode levar alguns segundos...',
    'Quase lá, não feche esta página...'
  ]);

  try {
    const fd = new FormData();
    fd.append('acao', 'criar_lead');
    fd.append('Etapa', '3');
    fd.append('UserId', userId);
    fd.append('Nome', nome);
    fd.append('Comercio', comercio);
    fd.append('WhatsApp', whatsappVal);
    fd.append('Estilo', estilo);

    const res = await fetch(cfg.scriptUrl, { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({ ok: res.ok }));
    if (!data.ok) throw new Error(data.error || 'Falha ao registrar o pedido.');

    CEF.setLead({ userId, nome, comercio, whatsapp: whatsappVal, estilo });
    CEF.setProgress({ dados: true, estilo: true });

    const numeroLimpo = whatsappVal.replace(/\D/g, '');
    const params = new URLSearchParams({ name: nome, phone: numeroLimpo, s1: userId });
    window.location.href = `${cfg.kiwifyCheckoutUrl}?${params.toString()}`;
  } catch (err) {
    console.error(err);
    CEF.hideLoading();
    alert('Não foi possível continuar agora. Tente novamente em instantes.');
  }
});

document.querySelector('#year').textContent = new Date().getFullYear();
showStep();
