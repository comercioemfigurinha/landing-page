const form = document.querySelector('#leadForm');
const steps = [...document.querySelectorAll('.form-step')];
const nextBtn = document.querySelector('#nextBtn'), backBtn = document.querySelector('#backBtn');
const progressFill = document.querySelector('#progressFill'), stepLabel = document.querySelector('#stepLabel');
const whatsapp = document.querySelector('#whatsapp');
const estiloField = document.querySelector('#estiloField');
const comercioField = document.querySelector('#comercioField');
const comercioInput = form.Comercio;
const contactHelp = document.querySelector('#contactHelp');
let current = 0;
const temaAtual = new URLSearchParams(location.search).get('tema') || '';
const temaField = document.querySelector('#temaField');
temaField.value = temaAtual;
const temaInfo = document.querySelector('#temaInfo');
const nomeTema = temaAtual ? temaAtual.replace(/[-_]/g, ' ') : 'seu nicho';
temaInfo.textContent = `Escolhendo figurinhas para: ${nomeTema}`;
estiloField.value = 'Pronto';

const nicheInput = document.querySelector('#nichoEscolhido'), modelInput = document.querySelector('#modeloEscolhido');
const availableNiches = ['confeitaria'];
let chosenNiche = 'confeitaria';
let chosenModel = '';
if (!sessionStorage.getItem('cef_landing_order_active')) {
  CEFSupabase.clearOrderSession();
  CEF.clearAll();
  sessionStorage.removeItem('cefPedido');
  sessionStorage.setItem('cef_landing_order_active', '1');
}
const saved = (() => {try{return JSON.parse(sessionStorage.getItem('cefPedido')||'{}')}catch{return {}}})();
if(saved.nicho && availableNiches.includes(saved.nicho)) chosenNiche=saved.nicho;
if(saved.modelo && saved.modelo.startsWith(chosenNiche+'-')) chosenModel=saved.modelo;
function persistChoice(){nicheInput.value=chosenNiche;modelInput.value=chosenModel;sessionStorage.setItem('cefPedido',JSON.stringify({temaAnuncio:temaAtual,nicho:chosenNiche,modelo:chosenModel,plano:estiloField.value}));}
function renderModels(){
  persistChoice();
  temaInfo.textContent=`Nicho selecionado: ${chosenNiche.replaceAll('-',' ')}`;
  document.querySelector('#modelGrid').innerHTML=[1,2,3].map(n=>{const id=`${chosenNiche}-${String(n).padStart(2,'0')}`;const path=`assets/pacotes/${chosenNiche}/modelo-${String(n).padStart(2,'0')}.webp`;return `<div class="model-card ${chosenModel===id?'chosen':''}"><button type="button" class="model-select" data-id="${id}"><img src="${path}" alt="Pacote ${n} de ${chosenNiche}" loading="lazy" decoding="async" onerror="this.style.opacity='.15'"><strong>Modelo 0${n}</strong><span>${chosenModel===id?'✓ Selecionado':'Escolher pacote'}</span></button><button type="button" class="model-zoom" data-path="${path}" aria-label="Ampliar modelo ${n}">⛶ Ampliar</button></div>`}).join('');
  document.querySelectorAll('.model-select').forEach(b=>b.onclick=()=>{chosenModel=b.dataset.id;renderModels()});
  document.querySelectorAll('.model-zoom').forEach(b=>b.onclick=()=>{document.querySelector('#lightboxImg').src=b.dataset.path;document.querySelector('#imageLightbox').hidden=false});
}
document.querySelector('#closeLightbox').onclick=()=>document.querySelector('#imageLightbox').hidden=true;
document.querySelector('#imageLightbox').onclick=e=>{if(e.target.id==='imageLightbox')e.currentTarget.hidden=true};
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelector('#imageLightbox').hidden=true});
function isBasic(){return estiloField.value === 'Pronto';}
function updateContactFields(){
  const basic = isBasic();
  comercioField.hidden = basic;
  comercioInput.required = !basic;
  if (basic) comercioInput.value = '';
  contactHelp.textContent = basic
    ? 'Para o plano básico, precisamos apenas do seu nome e WhatsApp para identificar a compra.'
    : 'Para personalizar corretamente, precisamos também do nome do seu comércio ou marca.';
}
function updateChoice(){const basic=isBasic();document.querySelector('#basicPicker').hidden=!basic;document.querySelector('#customPreview').hidden=basic;document.querySelector('#choiceHeading').textContent=basic?'Escolha seu pacote de 9 figurinhas':'Como ficaria sua personagem?';document.querySelector('#choiceDesc').textContent=basic?'Escolha 1 dos 3 modelos. Toque em ampliar para ver os detalhes.':'Veja a transformação da foto em figurinha personalizada. As informações da sua marca serão coletadas após o pagamento.';updateContactFields();persistChoice();}
renderModels();
if(saved.plano==='Personalizado'){document.querySelector('#personalizadoCard input').checked=true;estiloField.value='Personalizado';document.querySelector('#prontoCard').classList.remove('selected');document.querySelector('#personalizadoCard').classList.add('selected');}
updateChoice();
// UserId único desta visita: nasce na etapa 1 e é reaproveitado até o checkout,
// assim a mesma linha da planilha vai sendo atualizada (sem duplicar).
let userId = CEFSupabase.getOrderSession()?.orderId || null;

function orderPayload(etapa) {
  return {
    form_step: etapa,
    customer_name: form.Nome.value.trim(),
    business_name: form.Comercio.value.trim(),
    whatsapp: CEFSupabase.cleanPhone(form.WhatsApp.value),
    plan: isBasic() ? 'basico' : 'personalizado',
    amount_cents: isBasic() ? 1450 : 3940,
    campaign_theme: temaAtual,
    niche: chosenNiche,
    package_model: chosenModel,
    payment_status: 'pendente',
    service_status: 'a_pagar'
  };
}

// Registra no admin até onde a pessoa chegou (etapa 1, 2 ou 3).
// Não bloqueia a navegação: se falhar, o formulário segue normalmente.
async function salvarEtapa(etapa) {
  try {
    const saved = await CEFSupabase.saveOrder(orderPayload(etapa));
    userId = saved.order_id;
  } catch (error) {
    console.warn('Não foi possível salvar o progresso:', error);
  }
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
  if (current === 0) { CEF.setProgress({ estilo: true }); }
  if (current === 1) {
    if(estiloField.value==='Pronto' && !chosenModel){alert('Escolha um dos 3 modelos antes de continuar.');return;}
    CEF.setProgress({ dados: true });
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

// ---- Escolha do pacote ----
document.querySelectorAll('.offer-card input').forEach(input => {
  input.addEventListener('change', () => {
    document.querySelectorAll('.offer-card').forEach(c => c.classList.remove('selected'));
    input.closest('.offer-card').classList.add('selected');
    estiloField.value = input.value;
    updateChoice();
    document.querySelector('#customIntro').hidden = input.value !== 'Personalizado';
    document.querySelectorAll('.offer-card').forEach(c => {
      c.querySelector('.offer-choice').textContent = c.classList.contains('selected') ? 'Selecionado ✓' : 'Escolher este pacote →';
    });
  });
});

// Flip individual dos cards: o verso reutiliza os mesmos modelos e escolhas da etapa 2.
const cardsFlip = [...document.querySelectorAll('.offer-card')];
cardsFlip.forEach(card => {
  const front = document.createElement('div'); front.className = 'offer-front';
  // O input radio permanece no label, e os elementos visuais passam para a frente.
  [...card.children].filter(node => node.tagName !== 'INPUT').forEach(node => front.appendChild(node));
  card.appendChild(front);
  const back = document.createElement('div'); back.className = 'offer-back';
  back.setAttribute('aria-hidden','true');
  card.appendChild(back);
  card.querySelector('.offer-examples').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const input = card.querySelector('input'); input.checked = true;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    cardsFlip.forEach(other=>{if(other!==card)closeCard(other)});
    if(card.classList.contains('is-flipped')) closeCard(card);
    else {renderCardBack(card);card.classList.add('is-flipped');back.setAttribute('aria-hidden','false')}
  });
  // Interações dentro do verso não devem ativar o label automaticamente.
  back.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});
});
function closeCard(card){card.classList.remove('is-flipped');card.querySelector('.offer-back').setAttribute('aria-hidden','true')}
function renderCardBack(card){
  const back = card.querySelector('.offer-back');
  const basic = card.id==='prontoCard';
  back.innerHTML = `<div class="offer-back-head"><strong>${basic?'Escolha seu modelo':'Veja a transformação'}</strong><button type="button" class="offer-back-close"><i class="fa-solid fa-reply"></i></button></div>`;
  back.querySelector('.offer-back-close').onclick=()=>closeCard(card);
  const slides = basic ? [1,2,3].map(n => ({
    label:`Modelo ${String(n).padStart(2,'0')}`,
    id:`${chosenNiche}-${String(n).padStart(2,'0')}`,
    image:`assets/pacotes/${chosenNiche}/modelo-${String(n).padStart(2,'0')}.webp`
  })) : [1,2,3].map(n=>({
    label:`Transformação ${n}`,
    photo:`assets/personalizados/exemplo-${String(n).padStart(2,'0')}-foto.webp`,
    sticker:`assets/personalizados/exemplo-${String(n).padStart(2,'0')}-mascote.webp`
  }));
  const note=document.createElement('div');note.className='offer-back-note';
  note.textContent=basic?'Nicho: '+chosenNiche.replaceAll('-',' '):'3 exemplos: foto original em cima e figurinha criada embaixo.';
  back.appendChild(note);
  const carousel=document.createElement('div');carousel.className='flip-carousel';back.appendChild(carousel);
  const track=document.createElement('div');track.className='flip-carousel-track';carousel.appendChild(track);
  let active=basic?Math.max(0,slides.findIndex(x=>x.id===chosenModel)):0;
  if(active<0)active=0;
  slides.forEach((slide,i)=>{
    const item=document.createElement('button');item.type='button';item.className='flip-slide';
    item.innerHTML=basic?`<img src="${slide.image}" alt="${slide.label}" loading="lazy"><span>${slide.label}</span>`:`<div class="premium-pair"><div><img src="${slide.photo}" alt="Foto original ${i+1}" loading="lazy"><small>Foto original</small></div><div><img src="${slide.sticker}" alt="Figurinha criada ${i+1}" loading="lazy"><small>Figurinha criada</small></div></div><span>${slide.label}</span>`;
    item.querySelectorAll('img').forEach(img=>img.addEventListener('error',e=>{e.target.style.opacity='.2'}));
    item.addEventListener('click',()=>{if(i!==active){activate(i);return;}if(basic){chosenModel=slide.id;renderModels();activate(i)}else{activate(i)}});
    track.appendChild(item);
  });
  const controls=document.createElement('div');controls.className='flip-carousel-controls';
  controls.innerHTML='<button type="button" class="flip-prev" aria-label="Exemplo anterior">‹</button><span class="flip-count"></span><button type="button" class="flip-next" aria-label="Próximo exemplo">›</button>';
  if(!basic){controls.querySelector('.flip-prev').classList.add('premium-flat-arrow');controls.querySelector('.flip-next').classList.add('premium-flat-arrow');controls.querySelector('.flip-prev').innerHTML='&#8592;';controls.querySelector('.flip-next').innerHTML='&#8594;';}
  back.appendChild(controls);
  const select=document.createElement('button');select.type='button';select.className='offer-back-select';select.textContent='Selecionar plano →';
  function activate(index){
    active=(index+slides.length)%slides.length;
    [...track.children].forEach((el,i)=>{el.classList.toggle('active',i===active);el.classList.toggle('before',i===(active+slides.length-1)%slides.length);el.classList.toggle('after',i===(active+1)%slides.length);el.setAttribute('aria-label',slides[i].label+(basic&&chosenModel===slides[i].id?' selecionado':''));});
    controls.querySelector('.flip-count').textContent=`${active+1} / ${slides.length}`;
    if(basic){chosenModel=slides[active].id;renderModels();select.disabled=false;}
  }
  controls.querySelector('.flip-prev').onclick=()=>activate(active-1);
  controls.querySelector('.flip-next').onclick=()=>activate(active+1);
  let touchStart=0;
  carousel.addEventListener('touchstart',e=>{touchStart=e.changedTouches[0].clientX},{passive:true});
  carousel.addEventListener('touchend',e=>{const diff=e.changedTouches[0].clientX-touchStart;if(Math.abs(diff)>35)activate(active+(diff<0?1:-1))},{passive:true});
  carousel.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();activate(active+1)}if(e.key==='ArrowLeft'){e.preventDefault();activate(active-1)}});
  if(basic){
    const zoom=document.createElement('button');zoom.type='button';zoom.className='flip-other';zoom.textContent='⛶ Ampliar exemplo';zoom.onclick=()=>{document.querySelector('#lightboxImg').src=slides[active].image;document.querySelector('#imageLightbox').hidden=false};back.appendChild(zoom);
  }
  if(!basic){const more=document.createElement('button');more.type='button';more.className='flip-other';more.textContent='Ver mais exemplos →';more.onclick=()=>activate(active+1);back.appendChild(more)}
  activate(active);
  select.disabled=basic&&!chosenModel;
  select.onclick=()=>{
    const input=card.querySelector('input');input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));
    closeCard(card);
    CEF.setProgress({ estilo: true });
    goTo(2,true);
  };
  back.appendChild(select);
}

// ---- FAQ ----
document.querySelectorAll('.faq-item').forEach(item => {
  const button = item.querySelector('.faq-q');
  button.addEventListener('click', () => {
    const open = item.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
  });
});

function review(){
  updateContactFields();
  document.querySelector('#summaryLine').textContent=isBasic()
    ? `Plano básico • ${chosenNiche} • ${chosenModel || 'modelo a escolher'} • R$ 14,50`
    : 'Plano personalizado • 9 figurinhas + mascote + foto de perfil • R$ 39,40';
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (isBasic() && !chosenModel){alert('Selecione um modelo.');goTo(1,false);return;}
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const cfg = window.CHECKOUT_CONFIG || {};
  const checkout = isBasic() ? cfg.basico : cfg.personalizado;
  if (!checkout || !/^https:\/\//.test(checkout)) {
    alert('Este pacote ainda não tem um link de pagamento configurado. Entre em contato com o suporte para concluir a compra.');
    return;
  }
  const nome = form.Nome.value, comercio = form.Comercio.value, whatsappVal = form.WhatsApp.value, estilo = estiloField.value;

  CEF.showLoading('Preparando seu checkout...');

  try {
    const savedOrder = await CEFSupabase.saveOrder(orderPayload(3));
    userId = savedOrder.order_id;

    CEF.clearAll();
    CEF.setLead({ userId, nome, comercio, whatsapp: whatsappVal, estilo, plano: isBasic() ? 'Básico' : 'Personalizado', valor: isBasic() ? 'R$ 14,50' : 'R$ 39,40', tema: temaAtual, nicho: chosenNiche, modelo: chosenModel });
    CEF.setProgress({ dados: true, estilo: true });

    const numeroLimpo = whatsappVal.replace(/\D/g, '');
    const params = new URLSearchParams({ name: nome, phone: numeroLimpo, s1: userId });
    sessionStorage.removeItem('cef_landing_order_active');
    window.location.href = `${checkout}${checkout.includes('?') ? "&" : "?"}${params.toString()}`;
  } catch (err) {
    console.error(err);
    CEF.hideLoading();
    alert('Não foi possível continuar agora. Tente novamente em instantes.');
  }
});

document.querySelector('#year').textContent = new Date().getFullYear();
showStep();
