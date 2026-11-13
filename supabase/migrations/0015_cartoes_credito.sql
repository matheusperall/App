-- Sempre Zero — Cartões de crédito da empresa (compras, faturas e pagamento da fatura)
-- Execute no Supabase depois do 0014: SQL Editor > New query > cole > Run
--
-- Como funciona:
--   * Cada compra no cartão é um lançamento de saída com cartao_id e fatura_mes (mês do vencimento da fatura).
--   * A compra conta como despesa no resultado pela data dela (competência).
--   * Ela fica "a pagar" e sem conta até a fatura ser paga; ao pagar a fatura, todas as compras dela
--     passam a pagas, saindo da conta escolhida. Assim o dinheiro sai uma vez só, sem duplicar.

create table if not exists public.cartoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  final text check (final is null or final ~ '^[0-9]{4}$'), -- 4 últimos números
  limite numeric(12, 2) check (limite is null or limite >= 0),
  dia_fechamento integer not null check (dia_fechamento between 1 and 31),
  dia_vencimento integer not null check (dia_vencimento between 1 and 31),
  conta_pagamento_id uuid references public.contas (id) on delete set null, -- conta que costuma pagar a fatura
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table public.cartoes enable row level security;
drop policy if exists "Somente a empresa" on public.cartoes;
create policy "Somente a empresa" on public.cartoes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.lancamentos
  add column if not exists cartao_id uuid references public.cartoes (id) on delete restrict,
  add column if not exists fatura_mes text check (fatura_mes is null or fatura_mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

create index if not exists lancamentos_cartao on public.lancamentos (cartao_id, fatura_mes) where cartao_id is not null;

-- Paga a fatura de um mês: todas as compras dela passam a pagas, saindo da conta escolhida.
create or replace function public.gestao_pagar_fatura_cartao(p_cartao uuid, p_fatura_mes text, p_conta uuid, p_data date default current_date)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_qtd integer;
begin
  if not public.is_admin() then
    raise exception 'Somente a empresa pode fazer isso.';
  end if;
  if not exists (select 1 from public.contas where id = p_conta) then
    raise exception 'Escolha a conta que pagou a fatura.';
  end if;
  update public.lancamentos
     set pago = true, pago_em = p_data, conta_id = p_conta
   where cartao_id = p_cartao and fatura_mes = p_fatura_mes and not pago;
  get diagnostics v_qtd = row_count;
  if v_qtd = 0 then
    raise exception 'Esta fatura não tem compras em aberto.';
  end if;
  return v_qtd;
end;
$$;

revoke execute on function public.gestao_pagar_fatura_cartao(uuid, text, uuid, date) from public, anon;
grant execute on function public.gestao_pagar_fatura_cartao(uuid, text, uuid, date) to authenticated;
