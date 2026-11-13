-- Sempre Zero — Modelos das mensagens de WhatsApp (editáveis pela empresa)
-- Execute no Supabase depois do 0017: SQL Editor > New query > cole > Run
--
-- Guarda só os modelos que a empresa mudou (tipo da mensagem → texto). O que não estiver aqui usa o texto padrão do app.

alter table public.gestao_config
  add column if not exists mensagens jsonb not null default '{}'::jsonb
  check (jsonb_typeof(mensagens) = 'object');
