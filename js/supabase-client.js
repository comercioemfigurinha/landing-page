(function () {
  const cfg = window.SUPABASE_CONFIG || {};
  if (!window.supabase || !cfg.url || !cfg.publishableKey) {
    console.error('Supabase não configurado.');
    return;
  }

  const client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  function cleanPhone(value) {
    return String(value || '').replace(/\D/g, '').slice(-11);
  }

  function randomToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function getOrderSession() {
    try { return JSON.parse(localStorage.getItem('cef_supabase_order') || 'null'); }
    catch (_) { return null; }
  }

  function setOrderSession(orderId, accessToken) {
    const value = { orderId, accessToken };
    localStorage.setItem('cef_supabase_order', JSON.stringify(value));
    return value;
  }

  function clearOrderSession() {
    localStorage.removeItem('cef_supabase_order');
  }

  async function saveOrder(payload) {
    const session = getOrderSession();
    const accessToken = session?.accessToken || randomToken();
    const { data, error } = await client.rpc('save_public_order', {
      p_order_id: session?.orderId || null,
      p_access_token: accessToken,
      p_payload: payload
    });
    if (error) throw error;
    const saved = Array.isArray(data) ? data[0] : data;
    setOrderSession(saved.order_id, accessToken);
    return saved;
  }

  async function getOrder() {
    const session = getOrderSession();
    if (!session) return null;
    const { data, error } = await client.rpc('get_public_order', {
      p_order_id: session.orderId,
      p_access_token: session.accessToken
    });
    if (error) throw error;
    return Array.isArray(data) ? (data[0] || null) : data;
  }

  async function imageToWebp(file, maxSize = 1800, quality = 0.84) {
    if (!file) return null;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('Falha ao converter imagem.')), 'image/webp', quality)
    );
    const safeName = String(file.name || 'imagem').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60);
    return new File([blob], `${safeName || 'imagem'}.webp`, { type: 'image/webp' });
  }

  async function uploadOrderImage(file, kind) {
    const session = getOrderSession();
    if (!session) throw new Error('Pedido não encontrado.');
    const webp = await imageToWebp(file);
    const path = `${session.orderId}/${session.accessToken}/${kind}-${Date.now()}.webp`;
    const { error } = await client.storage.from('order-assets').upload(path, webp, {
      contentType: 'image/webp', upsert: false, cacheControl: '31536000'
    });
    if (error) throw error;
    return path;
  }

  window.CEFSupabase = {
    client,
    cleanPhone,
    saveOrder,
    getOrder,
    getOrderSession,
    setOrderSession,
    clearOrderSession,
    imageToWebp,
    uploadOrderImage
  };
})();
