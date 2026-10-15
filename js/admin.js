(function () {
  const db = CEFSupabase.client;
  const gate = document.querySelector('#gate');
  const panel = document.querySelector('#painel');
  const email = document.querySelector('#emailInput');
  const password = document.querySelector('#senhaInput');
  const errorBox = document.querySelector('#gateError');
  const loginButton = document.querySelector('#entrarBtn');
  const grid = document.querySelector('#grid');
  const status = document.querySelector('#status');
  const filters = document.querySelector('#filters');
  let orders = [];
  let currentStatus = 'todos';

  const serviceLabels = {
    a_pagar: 'A pagar', pago: 'Pago', em_aprovacao: 'Em aprovação',
    concluido: 'Concluído', recusado: 'Recusado', reembolsado: 'Reembolsado'
  };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function money(cents) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
  }

  function dateTime(value) {
    return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
  }

  function withTimeout(request, milliseconds, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    });
    return Promise.race([Promise.resolve(request), timeout]).finally(() => clearTimeout(timer));
  }

  function showLoginMessage(message) {
    errorBox.textContent = message;
  }

  async function requireAdmin() {
    showLoginMessage('Verificando sua sessão...');
    const { data: { session } } = await withTimeout(
      db.auth.getSession(),
      10000,
      'A verificação da sessão demorou demais. Atualize a página e tente novamente.'
    );
    if (!session) {
      showLoginMessage('');
      return false;
    }

    showLoginMessage('Verificando permissão de administrador...');
    const { data, error } = await withTimeout(
      db.rpc('is_admin'),
      10000,
      'A verificação de administrador demorou demais. Confira a função is_admin no Supabase.'
    );
    if (error) throw new Error(`Não foi possível verificar o administrador: ${error.message}`);
    if (data !== true) {
      await db.auth.signOut();
      throw new Error('Este usuário não tem permissão de administrador. Confira se o usuário está na tabela public.admins.');
    }
    return true;
  }

  async function signIn() {
    errorBox.textContent = '';
    loginButton.disabled = true;
    loginButton.textContent = 'Entrando...';
    try {
      showLoginMessage('Validando e-mail e senha...');
      const { error } = await withTimeout(
        db.auth.signInWithPassword({ email: email.value.trim(), password: password.value }),
        15000,
        'O login demorou demais. Verifique sua conexão e tente novamente.'
      );
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : error.message);
      await openPanel();
    } catch (err) {
      panel.hidden = true;
      gate.hidden = false;
      errorBox.textContent = err.message || 'Não foi possível entrar. Tente novamente.';
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Entrar com segurança';
    }
  }

  async function openPanel() {
    if (!await requireAdmin()) return;
    gate.hidden = true;
    panel.hidden = false;
    try {
      await loadOrders();
    } catch (err) {
      status.textContent = err.message || 'Não foi possível carregar os pedidos.';
      throw err;
    }
  }

  async function loadOrders() {
    status.textContent = 'Carregando...';
    const { data, error } = await withTimeout(
      db.from('orders').select('*').order('created_at', { ascending: false }),
      15000,
      'O acesso foi liberado, mas os pedidos demoraram demais para carregar.'
    );
    if (error) throw error;
    orders = data || [];
    renderFilters();
    await render();
  }

  function renderFilters() {
    const keys = ['todos', ...Object.keys(serviceLabels)];
    filters.innerHTML = '<span class="filters-label">Status do serviço</span>' + keys.map(key => {
      const count = key === 'todos' ? orders.length : orders.filter(order => order.service_status === key).length;
      const label = key === 'todos' ? 'Todos' : serviceLabels[key];
      return `<button data-status="${key}" class="${currentStatus === key ? 'active' : ''}">${label} (${count})</button>`;
    }).join('');
    filters.querySelectorAll('[data-status]').forEach(button => button.onclick = () => {
      currentStatus = button.dataset.status;
      renderFilters();
      render();
    });
  }

  async function assetUrl(path) {
    if (!path) return '';
    const { data, error } = await db.storage.from('order-assets').createSignedUrl(path, 900);
    return error ? '' : data.signedUrl;
  }

  async function render() {
    const visible = orders.filter(order => currentStatus === 'todos' || order.service_status === currentStatus);
    status.textContent = `${visible.length} de ${orders.length} pedido(s).`;
    if (!visible.length) { grid.innerHTML = '<div class="empty">Nenhum pedido nesse filtro.</div>'; return; }
    const urls = await Promise.all(visible.map(async order => ({
      photo: await assetUrl(order.photo_path), logo: await assetUrl(order.logo_path)
    })));
    grid.innerHTML = visible.map((order, index) => {
      const phone = String(order.whatsapp || '').replace(/\D/g, '');
      const image = urls[index].photo || urls[index].logo;
      const phrases = Array.isArray(order.phrases) ? order.phrases.join('\n') : '';
      return `<article class="card" data-id="${order.id}">
        <div class="card-top">${image ? `<img src="${esc(image)}" alt="Imagem do pedido" loading="lazy">` : '<div class="noimg"><i class="fa-solid fa-image"></i></div>'}
          <div><h3>${esc(order.business_name || order.customer_name || 'Sem nome')}</h3><small>${esc(order.customer_name)} · ${dateTime(order.created_at)}</small></div>
        </div>
        <div class="row"><span>Etapa</span><span class="pill">${Number(order.form_step || 1)} de 4</span></div>
        <div class="row"><span>Plano</span><b>${order.plan === 'basico' ? 'Básico' : 'Personalizado'}</b></div>
        ${order.package_model ? `<div class="row"><span>Pacote</span><b>${esc(order.niche)} · ${esc(order.package_model)}</b></div>` : ''}
        <div class="row"><span>Valor</span><b>${money(order.amount_cents)}</b></div>
        <div class="row"><span>Pagamento</span><span class="pill ${esc(order.payment_status)}">${esc(order.payment_status || 'pendente')}</span></div>
        <div class="row"><span>WhatsApp</span><b>${esc(order.whatsapp)}</b></div>
        <div class="row"><span>Status</span><select class="status-select" data-service>${Object.entries(serviceLabels).map(([key, label]) => `<option value="${key}" ${order.service_status === key ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
        ${order.text_style ? `<div class="frases">Estilo: ${esc(order.text_style)}\nCor: ${esc(order.primary_color)}${order.secondary_color ? `\nSegunda cor: ${esc(order.secondary_color)}` : ''}${order.notes ? `\nObservações: ${esc(order.notes)}` : ''}</div>` : ''}
        ${phrases ? `<div class="frases">${esc(phrases)}</div>` : ''}
        <div class="card-links">
          ${phone ? `<a class="whats" href="https://wa.me/55${phone}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${urls[index].photo ? `<a href="${esc(urls[index].photo)}" target="_blank" rel="noopener">Ver foto</a>` : ''}
          ${urls[index].logo ? `<a href="${esc(urls[index].logo)}" target="_blank" rel="noopener">Ver logo</a>` : ''}
          <button data-delete class="btn-danger">Excluir</button>
        </div>
      </article>`;
    }).join('');
    grid.querySelectorAll('.card').forEach(card => {
      card.querySelector('[data-service]').onchange = event => updateOrder(card.dataset.id, { service_status: event.target.value });
      card.querySelector('[data-delete]').onclick = () => deleteOrder(card.dataset.id);
    });
  }

  async function updateOrder(id, values) {
    const { error } = await db.from('orders').update(values).eq('id', id);
    if (error) { alert('Não foi possível salvar.'); await loadOrders(); return; }
    Object.assign(orders.find(order => order.id === id), values);
    renderFilters();
  }

  async function deleteOrder(id) {
    if (!confirm('Excluir este pedido e seus dados? Essa ação não pode ser desfeita.')) return;
    const { error } = await db.from('orders').delete().eq('id', id);
    if (error) { alert('Não foi possível excluir o pedido.'); return; }
    orders = orders.filter(order => order.id !== id);
    renderFilters();
    await render();
  }

  function exportCsv() {
    const fields = ['id','created_at','updated_at','customer_name','business_name','whatsapp','plan','amount_cents','form_step','niche','package_model','payment_status','payment_method','paid_at','service_status','text_style','primary_color','has_secondary_color','secondary_color','notes','phrases','photo_path','logo_path','campaign_theme'];
    const quote = value => `"${String(Array.isArray(value) ? value.join(' | ') : value ?? '').replace(/"/g, '""')}"`;
    const csv = '\ufeff' + [fields.join(','), ...orders.map(order => fields.map(field => quote(order[field])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  loginButton.onclick = signIn;
  password.addEventListener('keydown', event => { if (event.key === 'Enter') signIn(); });
  document.querySelector('#refreshBtn').onclick = loadOrders;
  document.querySelector('#exportBtn').onclick = exportCsv;
  document.querySelector('#sairBtn').onclick = async () => { await db.auth.signOut(); location.reload(); };
  openPanel().catch(err => {
    panel.hidden = true;
    gate.hidden = false;
    errorBox.textContent = err.message || 'Não foi possível carregar o painel.';
  });
})();
