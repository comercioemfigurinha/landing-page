# Configuração do Supabase

O site usa somente a chave pública no navegador. A segurança dos pedidos depende das políticas RLS e das funções deste repositório; nunca coloque a `service_role` no GitHub.

## 1. Criar banco, políticas e Storage

No Supabase, abra **SQL Editor**, copie todo o arquivo `supabase/migrations/001_initial_schema.sql` e execute.

## 2. Criar o acesso administrativo

1. Abra **Authentication > Users > Add user** e crie seu usuário com e-mail e senha.
2. Volte ao SQL Editor e execute, trocando o e-mail:

```sql
insert into public.admins (user_id, display_name)
select id, 'Administrador' from auth.users where email = 'SEU_EMAIL_AQUI';
```

O painel fica em `admin.html`. Usuários autenticados que não estiverem em `public.admins` não conseguem consultar os pedidos.

## 3. Configurar o webhook da Kiwify

Instale a CLI do Supabase ou use o editor de Edge Functions do painel para publicar `supabase/functions/kiwify-webhook/index.ts`.

Crie um segredo longo e aleatório chamado `KIWIFY_WEBHOOK_TOKEN`. Configure na Kiwify a URL:

```text
https://qoddaxputwabowgyrjif.supabase.co/functions/v1/kiwify-webhook?token=SEU_TOKEN_SECRETO
```

Não salve esse token no repositório. Faça um pagamento de teste e confirme no painel se `payment_status` mudou para `pago`.

## Estrutura dos dados

- `orders`: um registro por pedido, com dados pessoais, plano, pagamento e produção em colunas próprias.
- `admins`: usuários do Supabase Auth autorizados a abrir o painel.
- `order-assets`: bucket privado para foto e logo; os uploads são convertidos para WebP no navegador.
- `metadata`: payload bruto do webhook, útil para auditoria sem poluir as colunas exportáveis.

O botão **Exportar CSV** no painel gera uma planilha com colunas estáveis, adequada para Excel ou Google Sheets.
