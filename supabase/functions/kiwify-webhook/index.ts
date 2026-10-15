import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const expectedToken = Deno.env.get('KIWIFY_WEBHOOK_TOKEN');
  const suppliedToken = request.headers.get('x-webhook-token') || new URL(request.url).searchParams.get('token');
  if (!expectedToken || suppliedToken !== expectedToken) return new Response('Unauthorized', { status: 401 });

  try {
    const payload = await request.json();
    const orderId = payload?.s1 || payload?.order?.s1 || payload?.Customer?.custom_fields?.s1;
    const providerId = String(payload?.order_id || payload?.id || payload?.order?.id || '');
    const rawStatus = String(payload?.status || payload?.order_status || payload?.order?.status || '').toLowerCase();
    const paymentMethod = String(payload?.payment_method || payload?.method || payload?.order?.payment_method || '');
    if (!orderId) return Response.json({ ok: false, error: 'missing_order_id' }, { status: 400 });

    const normalized = rawStatus.includes('refund') || rawStatus.includes('reembols') ? 'reembolsado'
      : rawStatus.includes('refus') || rawStatus.includes('cancel') || rawStatus.includes('declin') ? 'recusado'
      : rawStatus.includes('paid') || rawStatus.includes('aprov') || rawStatus.includes('pago') ? 'pago'
      : 'pendente';
    const serviceStatus = normalized === 'pago' ? 'pago' : normalized === 'pendente' ? 'a_pagar' : normalized;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const updates: Record<string, unknown> = {
      payment_status: normalized,
      service_status: serviceStatus,
      payment_method: paymentMethod,
      payment_provider_id: providerId || null,
      metadata: payload
    };
    if (normalized === 'pago') updates.paid_at = new Date().toISOString();
    const { error } = await supabase.from('orders').update(updates).eq('id', orderId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: 'webhook_error' }, { status: 500 });
  }
});
