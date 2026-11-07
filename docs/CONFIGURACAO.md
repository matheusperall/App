# Configuração — passo a passo

Este guia conecta o app ao banco de dados (Supabase) e coloca no ar (Vercel).
Enquanto isso não for feito, o app roda em **modo demonstração**: as telas
aparecem, mas login e cadastro não funcionam.

## 1. Criar o projeto no Supabase (grátis)
1. Acesse https://supabase.com e entre com sua conta do GitHub.
2. Clique em **New project**. Nome: `sempre-zero`. Região: **South America (São Paulo)**.
   Crie uma senha forte para o banco e guarde-a.
3. Aguarde o projeto ficar pronto (1–2 minutos).

## 2. Criar as tabelas
1. No Supabase, abra **SQL Editor** → **New query**.
2. Copie todo o conteúdo de `supabase/migrations/0001_perfis.sql`, cole e clique em **Run**.

## 3. Ajustar o login por e-mail
Em **Authentication → URL Configuration**:
- **Site URL**: o endereço do app (ex.: `https://sempre-zero.vercel.app`; em testes locais, `http://localhost:3000`).
- **Redirect URLs**: adicione `https://SEU-ENDERECO/auth/confirm` (e `http://localhost:3000/auth/confirm` para testes).

Em **Authentication → Email Templates**, os textos podem ser traduzidos para português.
Os links padrão já funcionam com o app.

> O Supabase envia poucos e-mails por hora no plano grátis. Antes de abrir para os
> clientes, configure um serviço de e-mail próprio (ex.: Resend) em
> **Authentication → SMTP Settings**. Vou te ajudar nesse passo.

## 4. Pegar as chaves
Em **Project Settings → API**, copie:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Essas duas são públicas por natureza (a segurança fica nas regras do banco).
**Nunca** compartilhe a chave `service_role`.

## 5. Colocar no ar na Vercel
1. Acesse https://vercel.com e entre com o GitHub.
2. **Add New → Project** → importe o repositório `App`.
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = o endereço final do app
4. Clique em **Deploy**.

## 6. Tornar sua conta administradora
1. Abra o app e crie sua conta normalmente em **Criar conta**.
2. No Supabase, em **SQL Editor**, rode (trocando pelo seu e-mail):
   ```sql
   update public.perfis set papel = 'admin' where email = 'seu-email@exemplo.com';
   ```
3. Saia e entre de novo: o menu **Painel** vai aparecer.

## Rodar no computador (para desenvolvedores)
```bash
cp .env.example .env.local   # preencha com as chaves
npm install
npm run dev                  # http://localhost:3000
```
