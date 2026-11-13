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
2. Rode os arquivos da pasta `supabase/migrations`, **um de cada vez e na ordem**
   (copie o conteúdo, cole e clique em **Run**):
   1. `0001_perfis.sql` — contas e perfis
   2. `0002_garagem.sql` — veículos, histórico, lembretes e fotos
   3. `0003_apontamentos.sql` — apontamentos, avisos e notificações no celular
   4. `0004_fipe.sql` — dados da tabela FIPE no veículo
   5. `0005_lembretes.sql` — documentos/vencimentos e lembretes automáticos
   6. `0006_orcamentos.sql` — pedidos de orçamento
   7. `0007_agendamentos.sql` — agendamentos
   8. `0008_km_e_comunicados.sql` — ritmo de uso (previsão por km) e comunicados
   9. `0009_uf_veiculo.sql` — estado do veículo (calendário de IPVA e licenciamento)
   10. `0010_gestao.sql` — gestão da loja: OS, catálogo, estoque, financeiro e faturas (veja [GESTAO.md](GESTAO.md))
   11. `0011_formas_recebimento.sql` — formas de recebimento e taxas por conta (parcelas no crédito)
   12. `0012_faturas_e_lancamentos.sql` — pagamento de fatura com taxas e lançamentos recorrentes/parcelados
   13. `0013_pagamentos_os.sql` — OS paga em vários pagamentos (ou em partes)
   14. `0014_anexos_documentos.sql` — anexos de documentos (CNH, CRLV-e, apólice e outros)
   15. `0015_cartoes_credito.sql` — cartões de crédito da empresa (compras, faturas e pagamento)

   (Para um projeto novo, dá para rodar `supabase/instalar_tudo.sql`, que junta todos.)

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

Copie também a **service_role key**. Ela é **secreta**: serve para a empresa cadastrar
clientes e enviar convites. Cole-a **somente** na Vercel (passo 5). Não envie por
chat, e-mail ou WhatsApp, nem para mim.

## 5. Colocar no ar na Vercel
1. Acesse https://vercel.com e entre com o GitHub.
2. **Add New → Project** → importe o repositório `App`.
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` = o endereço final do app
   - `SUPABASE_SERVICE_ROLE_KEY` = a chave secreta service_role
4. Clique em **Deploy**.

## 5.1 Notificações no celular e e-mails (opcional, recomendado)
Entre no app como administrador e abra **Atendimento › Configurações**. A página gera as
chaves de notificação (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`) e explica
como ativar os e-mails de aviso (`RESEND_API_KEY` e `EMAIL_REMETENTE`). Depois de
cadastrar na Vercel, faça Redeploy.

Na mesma página há a senha `CRON_SECRET`, que ativa os **lembretes automáticos diários**
(agendados no arquivo `vercel.json`, todo dia por volta das 8h de Brasília).

## 5.2 Google Agenda
Veja o passo a passo em [GOOGLE_AGENDA.md](GOOGLE_AGENDA.md).

## 6. Tornar sua conta administradora
1. Abra o app e crie sua conta normalmente em **Criar conta**.
2. No Supabase, em **SQL Editor**, rode (trocando pelo seu e-mail):
   ```sql
   update public.perfis set papel = 'admin' where email = 'seu-email@exemplo.com';
   ```
3. Saia e entre de novo: o menu **Atendimento** (e a **Gestão**) vai aparecer.

## Rodar no computador (para desenvolvedores)
```bash
cp .env.example .env.local   # preencha com as chaves
npm install
npm run dev                  # http://localhost:3000
```
