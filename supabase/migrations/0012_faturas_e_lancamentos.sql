-- Sempre Zero — Pagamento de fatura com forma/conta/parcelas e lançamentos recorrentes ou parcelados
-- Execute no Supabase depois do 0011: SQL Editor > New query > cole > Run

-- ---------------------------------------------------------------------------
-- Lançamentos recorrentes (todo mês) e parcelados (valor dividido em N meses)
-- Os lançamentos de uma mesma série têm o mesmo grupo_id.
-- ---------------------------------------------------------------------------
alter table public.lancamentos
  add column if not exists grupo_id uuid,
  add column if not exists parcela integer check (parcela >= 1),
  add column if not exists total_parcelas integer check (total_parcelas >= 1),
  add column if not exists recorrente boolean not null default false;

create index if not exists lancamentos_grupo on public.lancamentos (grupo_id) where grupo_id is not null;

-- ---------------------------------------------------------------------------
-- Pagamento de fatura: a conta precisa aceitar a forma; a taxa (Pix, débito, crédito e parcelas)
-- vem da conta e é lançada como saída, igual ao recebimento da OS.
-- ---------------------------------------------------------------------------
alter table public.fatura_pagamentos
  add column if not exists parcelas integer check (parcelas between 1 and 24),
  add column if not exists taxa_valor numeric(12, 2) not null default 0;

drop function if exists public.gestao_pagar_fatura(uuid, numeric, text, uuid, date);

create or replace function public.gestao_pagar_fatura(
  p_fatura uuid,
  p_valor numeric,
  p_forma text,
  p_conta uuid,
  p_data date default current_date,
  p_parcelas integer default 1
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  f record;
  k record;
  v_lanc uuid;
  v_parcelas integer := coalesce(p_parcelas, 1);
  v_taxa_pct numeric := 0;
  v_taxa numeric := 0;
  v_rotulo text;
begin
  if not public.is_admin() then
    raise exception 'Somente a empresa pode fazer isso.';
  end if;
  if p_forma not in ('pix', 'dinheiro', 'debito', 'credito', 'transferencia') then
    raise exception 'Forma de pagamento inválida.';
  end if;

  select * into k from public.contas where id = p_conta;
  if k is null then
    raise exception 'Conta não encontrada.';
  end if;
  if not (p_forma = any (k.formas)) then
    raise exception 'Esta conta não recebe nesta forma de pagamento.';
  end if;

  select * into f from public.faturas where id = p_fatura for update;
  if f is null then
    raise exception 'Fatura não encontrada.';
  end if;
  if f.situacao in ('paga', 'cancelada') then
    raise exception 'Esta fatura não está em aberto.';
  end if;
  if p_valor is null or p_valor <= 0 or p_valor > f.total - f.valor_pago + 0.001 then
    raise exception 'Valor inválido: o saldo em aberto é %.', to_char(f.total - f.valor_pago, 'FM999G999G990D00');
  end if;

  if p_forma <> 'credito' then
    v_parcelas := 1;
  end if;
  if p_forma = 'pix' then
    v_taxa_pct := k.taxa_pix;
  elsif p_forma = 'debito' then
    v_taxa_pct := k.taxa_debito;
  elsif p_forma = 'credito' and v_parcelas = 1 then
    v_taxa_pct := k.taxa_credito;
  elsif p_forma = 'credito' then
    if not (k.taxas_parcelado ? v_parcelas::text) then
      raise exception 'Esta conta não aceita crédito em % vezes.', v_parcelas;
    end if;
    v_taxa_pct := (k.taxas_parcelado ->> v_parcelas::text)::numeric;
  end if;
  v_taxa := round(p_valor * coalesce(v_taxa_pct, 0) / 100, 2);
  v_rotulo := case p_forma
    when 'pix' then 'Pix'
    when 'debito' then 'débito'
    when 'credito' then 'crédito' || case when v_parcelas > 1 then ' ' || v_parcelas || 'x' else '' end
    else p_forma end;

  insert into public.lancamentos (data, tipo, descricao, valor, categoria_id, conta_id, pago, pago_em, fatura_id)
  values (p_data, 'entrada', 'Fatura #' || f.numero, round(p_valor, 2),
          (select id from public.categorias_financeiras where sistema = 'fatura'), p_conta, true, p_data, p_fatura)
  returning id into v_lanc;

  if v_taxa > 0 then
    insert into public.lancamentos (data, tipo, descricao, valor, categoria_id, conta_id, pago, pago_em, fatura_id)
    values (p_data, 'saida', 'Taxa ' || v_rotulo || ' · Fatura #' || f.numero, v_taxa,
            (select id from public.categorias_financeiras where sistema = 'taxa'), p_conta, true, p_data, p_fatura);
  end if;

  insert into public.fatura_pagamentos (fatura_id, data, valor, forma, conta_id, lancamento_id, parcelas, taxa_valor)
  values (p_fatura, p_data, round(p_valor, 2), p_forma, p_conta, v_lanc,
          case when p_forma = 'credito' then v_parcelas else null end, v_taxa);

  -- Fatura quitada: as OS dela ficam como pagas
  if (select situacao from public.faturas where id = p_fatura) = 'paga' then
    update public.ordens_servico
       set pago = true, pago_em = p_data, forma_pagamento = p_forma, conta_id = p_conta
     where fatura_id = p_fatura;
  end if;
end;
$$;

revoke execute on function public.gestao_pagar_fatura(uuid, numeric, text, uuid, date, integer) from public, anon;
grant execute on function public.gestao_pagar_fatura(uuid, numeric, text, uuid, date, integer) to authenticated;
