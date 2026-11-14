-- Sempre Zero — Tipo "maquininha" nas contas; cor e bandeira nos cartões
-- Execute no Supabase depois do 0020: SQL Editor > New query > cole > Run

-- Contas: novo tipo "maquininha" (máquina de cartão, ex.: InfinitePay, Mercado Pago)
alter table public.contas drop constraint if exists contas_tipo_check;
alter table public.contas add constraint contas_tipo_check check (tipo in ('banco', 'caixa', 'digital', 'maquininha', 'outro'));

-- As maquininhas que vieram da CERA
update public.contas set tipo = 'maquininha' where tipo = 'digital' and lower(nome) in ('infinitepay', 'mercado pago');

-- Cartões: cor escolhida e bandeira
alter table public.cartoes
  add column if not exists cor text check (cor is null or cor ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists bandeira text check (bandeira is null or bandeira in ('visa', 'mastercard', 'elo', 'amex', 'hipercard'));
