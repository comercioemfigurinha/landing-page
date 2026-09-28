const form = document.querySelector('#leadForm');
const steps = [...document.querySelectorAll('.form-step')];
const nextBtn = document.querySelector('#nextBtn'), backBtn = document.querySelector('#backBtn');
const progressFill = document.querySelector('#progressFill'), stepLabel = document.querySelector('#stepLabel');
const whatsapp = document.querySelector('#whatsapp');
const estiloField = document.querySelector('#estiloField');
let current = 0;

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
  if (current === 0) CEF.setProgress({ dados: true });
  if (current === 1) CEF.setProgress({ estilo: true });
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

document.querySelector('#examplesToggle').addEventListener('click', function () {
  const strip = document.querySelector('#examplesStrip');
  const aberto = strip.classList.toggle('open');
  this.textContent = aberto ? 'Ver menos exemplos' : 'Quero ver mais exemplos';
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

  const userId = CEF.gerarUserId();
  const nome = form.Nome.value, comercio = form.Comercio.value, whatsappVal = form.WhatsApp.value, estilo = estiloField.value;

  CEF.showLoading([
    'Preparando seu pedido...',
    'Isso pode levar alguns segundos...',
    'Quase lá, não feche esta página...'
  ]);

  try {
    const fd = new FormData();
    fd.append('acao', 'criar_lead');
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
