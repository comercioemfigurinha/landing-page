-- Comércio em Figurinha — banco, autenticação, RLS e armazenamento privado
-- Execute este arquivo uma única vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create type public.order_plan as enum ('basico', 'personalizado');
create type public.payment_status as enum ('pendente', 'pago', 'recusado', 'reembolsado');
create type public.service_status as enum ('a_pagar', 'pago', 'em_aprovacao', 'concluido', 'recusado', 'reembolsado');

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  access_token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_name text not null default '',
  business_name text not null default '',
  whatsapp text not null default '',
  plan public.order_plan not null default 'basico',
  amount_cents integer not null default 0 check (amount_cents >= 0),
  form_step smallint not null default 1 check (form_step between 1 and 4),
  campaign_theme text not null default '',
  niche text not null default '',
  package_model text not null default '',
  payment_status public.payment_status not null default 'pendente',
  payment_method text not null default '',
  payment_provider text not null default 'kiwify',
  payment_provider_id text,
  paid_at timestamptz,
  service_status public.service_status not null default 'a_pagar',
  text_style text not null default '',
  primary_color text not null default '',
  has_secondary_color boolean not null default false,
  secondary_color text not null default '',
  notes text not null default '',
  phrases text[] not null default '{}',
  photo_path text,
  logo_path text,
  metadata jsonb not null default '{}'
);

create unique index orders_payment_provider_id_idx
  on public.orders (payment_provider, payment_provider_id)
  where payment_provider_id is not null;
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_whatsapp_idx on public.orders (whatsapp);
create index orders_status_idx on public.orders (service_status, payment_status);
create index orders_plan_idx on public.orders (plan);

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.admins enable row level security;
alter table public.orders enable row level security;

create policy "admin reads own role" on public.admins
for select to authenticated using (user_id = auth.uid());

create policy "admins read orders" on public.orders
for select to authenticated using (public.is_admin());
create policy "admins update orders" on public.orders
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete orders" on public.orders
for delete to authenticated using (public.is_admin());

-- O navegador nunca recebe acesso direto à tabela. Esta função aceita apenas
-- campos conhecidos e exige o token secreto do próprio pedido para alterações.
create function public.save_public_order(
  p_order_id uuid,
  p_access_token text,
  p_payload jsonb
)
returns table(order_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_hash text;
  v_plan public.order_plan;
begin
  if length(coalesce(p_access_token, '')) < 48 then
    raise exception 'invalid_access_token';
  end if;
  v_hash := encode(digest(p_access_token, 'sha256'), 'hex');
  v_plan := case when p_payload->>'plan' = 'personalizado' then 'personalizado'::public.order_plan else 'basico'::public.order_plan end;

  if p_order_id is null then
    insert into public.orders (
      access_token_hash, customer_name, business_name, whatsapp, plan,
      amount_cents, form_step, campaign_theme, niche, package_model
    ) values (
      v_hash,
      left(coalesce(p_payload->>'customer_name', ''), 120),
      left(coalesce(p_payload->>'business_name', ''), 160),
      regexp_replace(coalesce(p_payload->>'whatsapp', ''), '[^0-9]', '', 'g'),
      v_plan,
      case when v_plan = 'basico' then 1450 else 3940 end,
      greatest(1, least(3, coalesce((p_payload->>'form_step')::smallint, 1))),
      left(coalesce(p_payload->>'campaign_theme', ''), 80),
      left(coalesce(p_payload->>'niche', ''), 80),
      left(coalesce(p_payload->>'package_model', ''), 100)
    ) returning id into v_id;
  else
    update public.orders set
      customer_name = case when p_payload ? 'customer_name' then left(p_payload->>'customer_name', 120) else customer_name end,
      business_name = case when p_payload ? 'business_name' then left(p_payload->>'business_name', 160) else business_name end,
      whatsapp = case when p_payload ? 'whatsapp' then regexp_replace(p_payload->>'whatsapp', '[^0-9]', '', 'g') else whatsapp end,
      plan = case when p_payload ? 'plan' then v_plan else plan end,
      amount_cents = case when p_payload ? 'plan' then (case when v_plan = 'basico' then 1450 else 3940 end) else amount_cents end,
      form_step = greatest(form_step, least(4, coalesce((p_payload->>'form_step')::smallint, form_step))),
      campaign_theme = case when p_payload ? 'campaign_theme' then left(p_payload->>'campaign_theme', 80) else campaign_theme end,
      niche = case when p_payload ? 'niche' then left(p_payload->>'niche', 80) else niche end,
      package_model = case when p_payload ? 'package_model' then left(p_payload->>'package_model', 100) else package_model end,
      text_style = case when p_payload ? 'text_style' then left(p_payload->>'text_style', 80) else text_style end,
      primary_color = case when p_payload ? 'primary_color' then left(p_payload->>'primary_color', 40) else primary_color end,
      has_secondary_color = case when p_payload ? 'has_secondary_color' then (p_payload->>'has_secondary_color')::boolean else has_secondary_color end,
      secondary_color = case when p_payload ? 'secondary_color' then left(p_payload->>'secondary_color', 40) else secondary_color end,
      notes = case when p_payload ? 'notes' then left(p_payload->>'notes', 3000) else notes end,
      phrases = case when p_payload ? 'phrases' then array(select left(value, 250) from jsonb_array_elements_text(p_payload->'phrases')) else phrases end,
      photo_path = case when p_payload ? 'photo_path' then nullif(left(p_payload->>'photo_path', 500), '') else photo_path end,
      logo_path = case when p_payload ? 'logo_path' then nullif(left(p_payload->>'logo_path', 500), '') else logo_path end,
      service_status = case when p_payload->>'service_status' = 'em_aprovacao' and plan = 'personalizado' then 'em_aprovacao'::public.service_status else service_status end
    where id = p_order_id and access_token_hash = v_hash
    returning id into v_id;

    if v_id is null then raise exception 'order_not_found'; end if;
  end if;
  return query select v_id;
end;
$$;

create function public.get_public_order(p_order_id uuid, p_access_token text)
returns table(
  id uuid, customer_name text, business_name text, whatsapp text,
  plan public.order_plan, amount_cents integer, form_step smallint,
  niche text, package_model text, payment_status public.payment_status,
  service_status public.service_status
)
language sql
security definer
set search_path = public, extensions
as $$
  select o.id, o.customer_name, o.business_name, o.whatsapp, o.plan,
         o.amount_cents, o.form_step, o.niche, o.package_model,
         o.payment_status, o.service_status
  from public.orders o
  where o.id = p_order_id
    and o.access_token_hash = encode(digest(p_access_token, 'sha256'), 'hex');
$$;

revoke all on function public.save_public_order(uuid, text, jsonb) from public;
revoke all on function public.get_public_order(uuid, text) from public;
grant execute on function public.save_public_order(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.get_public_order(uuid, text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-assets', 'order-assets', false, 5242880, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function public.can_access_order_asset(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.orders o
    where o.id::text = split_part(object_name, '/', 1)
      and o.access_token_hash = encode(digest(split_part(object_name, '/', 2), 'sha256'), 'hex')
  );
$$;

revoke all on function public.can_access_order_asset(text) from public;
grant execute on function public.can_access_order_asset(text) to anon, authenticated;

create policy "order owner uploads webp" on storage.objects
for insert to anon, authenticated
with check (bucket_id = 'order-assets' and public.can_access_order_asset(name));
create policy "admins read order assets" on storage.objects
for select to authenticated using (bucket_id = 'order-assets' and public.is_admin());
create policy "admins delete order assets" on storage.objects
for delete to authenticated using (bucket_id = 'order-assets' and public.is_admin());

-- Depois de criar seu usuário em Authentication > Users, execute:
-- insert into public.admins (user_id, display_name)
-- select id, 'Administrador' from auth.users where email = 'SEU_EMAIL_AQUI';
