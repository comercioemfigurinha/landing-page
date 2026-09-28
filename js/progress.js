// ======================================================================
// Progresso do pedido — compartilhado entre index.html e sucesso.html
// Usa localStorage porque o cliente sai do site (vai pro checkout da Kiwify)
// e depois volta numa página diferente; isso mantém a sensação de continuidade.
// ======================================================================
const CEF = (() => {
  const PROGRESS_KEY = 'cef_progress';
  const LEAD_KEY = 'cef_lead';

  const STEPS = [
    { id: 'dados', label: 'Envio do nome e telefone' },
    { id: 'estilo', label: 'Escolha do estilo' },
    { id: 'pagamento', label: 'Confirmação do pagamento' },
    { id: 'material', label: 'Envio da logo ou foto do perfil' },
    { id: 'aprovacao', label: 'Aprovação das frases' },
    { id: 'pacote', label: 'Envio do pacote completo para aprovação' },
  ];

  function getProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
    catch { return {}; }
  }
  function setProgress(partial) {
    const atual = getProgress();
    const novo = { ...atual, ...partial };
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(novo)); } catch {}
    return novo;
  }
  function getLead() {
    try { return JSON.parse(localStorage.getItem(LEAD_KEY)) || {}; }
    catch { return {}; }
  }
  function setLead(partial) {
    const atual = getLead();
    const novo = { ...atual, ...partial };
    try { localStorage.setItem(LEAD_KEY, JSON.stringify(novo)); } catch {}
    return novo;
  }
  function clearAll() {
    try { localStorage.removeItem(PROGRESS_KEY); localStorage.removeItem(LEAD_KEY); } catch {}
  }

  // Renderiza a barra de etapas dentro do elemento informado.
  // "ativoAte" é o id da última etapa concluída (tudo antes fica riscado).
  // "doneIds" (opcional) força quais etapas aparecem concluídas, ignorando o localStorage.
  function renderTracker(el, doneIds) {
    if (!el) return;
    const progresso = Array.isArray(doneIds)
      ? Object.fromEntries(doneIds.map(id => [id, true]))
      : getProgress();
    el.innerHTML = `<ol class="tracker">${STEPS.map(s => {
      const feito = !!progresso[s.id];
      const cls = feito ? 'done' : '';
      return `<li class="${cls}"><span class="tracker-dot">${feito ? '✓' : ''}</span><span class="tracker-text">${s.label}</span></li>`;
    }).join('')}</ol>`;
  }

  function money(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      reader.readAsDataURL(file);
    });
  }

  function gerarUserId() {
    const rand = (window.crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, '') : String(Math.random()).slice(2);
    return 'usr_' + rand.slice(0, 12);
  }

  // Overlay de carregamento com mensagens que vão mudando — usado nos momentos em que
  // o Google Sheets/Drive pode demorar alguns segundos, pra ninguém achar que travou.
  let msgTimer = null;
  function showLoading(mensagens) {
    const overlay = document.querySelector('#cefLoading');
    if (!overlay) return;
    const textEl = overlay.querySelector('.loading-text');
    const lista = Array.isArray(mensagens) ? mensagens : [mensagens];
    let i = 0;
    textEl.textContent = lista[0];
    overlay.classList.add('show');
    if (lista.length > 1) {
      msgTimer = setInterval(() => {
        i = (i + 1) % lista.length;
        textEl.textContent = lista[i];
      }, 2600);
    }
  }
  function hideLoading() {
    const overlay = document.querySelector('#cefLoading');
    if (msgTimer) { clearInterval(msgTimer); msgTimer = null; }
    if (overlay) overlay.classList.remove('show');
  }

  return { STEPS, getProgress, setProgress, getLead, setLead, clearAll, renderTracker, money, fileToBase64, gerarUserId, showLoading, hideLoading };
})();
