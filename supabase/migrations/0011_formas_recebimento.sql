-- Sempre Zero — Formas de recebimento e taxas por conta (com parcelas no crédito)
-- Execute no Supabase depois do 0010: SQL Editor > New query > cole > Run
--
-- Cada conta diz quais formas recebe (ex.: "Maquininha" recebe débito e crédito; "Banco" recebe Pix)
-- e qual taxa cobra em cada uma. No crédito, há uma taxa para cada número de parcelas.

alter table public.contas
  add column if not exists formas text[] not null default '{pix,dinheiro,debito,credito,transferencia}',
  add column if not exists taxa_pix numeric(5, 2) not null default 0 check (taxa_pix >= 0),
  add column if not exists taxa_debito numeric(5, 2) not null default 0 check (taxa_debito >= 0),
  add column if not exists taxa_credito numeric(5, 2) not null default 0 check (taxa_credito >= 0), -- crédito à vista (1x)
  -- crédito parcelado: { "2": 4.59, "3": 5.29, ... } — parcelas sem taxa preenchida não são aceitas
  add column if not exists taxas_parcelado jsonb not null default '{}';

alter table public.contas drop constraint if exists contas_formas_validas;
alter table public.contas add constraint contas_formas_validas
  check (formas <@ array['pix', 'dinheiro', 'debito', 'credito', 'transferencia']::text[]);

-- Contas que já existem: as taxas de cartão que estavam nas configurações passam para elas
update public.contas c
   set taxa_debito = g.taxa_debito,
       taxa_credito = g.taxa_credito
  from public.gestao_config g
 where c.taxa_debito = 0 and c.taxa_credito = 0;

-- Parcelas usadas no recebimento da OS
alter table public.ordens_servico
  add column if not exists parcelas integer check (parcelas between 1 and 24);

-- Recebimento da OS: a conta precisa aceitar a forma escolhida; a taxa vem da conta
drop function if exists public.gestao_receber_os(uuid, text, uuid, date);

create or replace function public.gestao_receber_os(
  p_os uuid,
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
  o record;
  k record;
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

  select os.*, c.lojista into o
    from public.ordens_servico os join public.clientes c on c.id = os.cliente_id
   where os.id = p_os for update of os;
  if o is null then
    raise exception 'OS não encontrada.';
  end if;
  if o.pago then
    raise exception 'Esta OS já foi recebida.';
  end if;
  if o.status = 'cancelada' then
    raise exception 'OS cancelada.';
  end if;
  if o.lojista then
    raise exception 'Cliente lojista: o valor entra na fatura do mês.';
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
  v_taxa := round(o.total * coalesce(v_taxa_pct, 0) / 100, 2);
  v_rotulo := case p_forma
    when 'pix' then 'Pix'
    when 'debito' then 'débito'
    when 'credito' then 'crédito' || case when v_parcelas > 1 then ' ' || v_parcelas || 'x' else '' end
    else p_forma end;

  if o.total > 0 then
    insert into public.lancamentos (data, tipo, descricao, valor, categoria_id, conta_id, pago, pago_em, os_id)
    values (p_data, 'entrada', 'OS #' || o.numero || coalesce(' · ' || o.placa, ''), o.total,
            (select id from public.categorias_financeiras where sistema = 'os'), p_conta, true, p_data, p_os);
  end if;
  if v_taxa > 0 then
    insert into public.lancamentos (data, tipo, descricao, valor, categoria_id, conta_id, pago, pago_em, os_id)
    values (p_data, 'saida', 'Taxa ' || v_rotulo || ' · OS #' || o.numero,
            v_taxa, (select id from public.categorias_financeiras where sistema = 'taxa'), p_conta, true, p_data, p_os);
  end if;

  update public.ordens_servico
     set pago = true, pago_em = p_data, forma_pagamento = p_forma, conta_id = p_conta,
         taxa_valor = v_taxa, parcelas = case when p_forma = 'credito' then v_parcelas else null end
   where id = p_os;
end;
$$;

revoke execute on function public.gestao_receber_os(uuid, text, uuid, date, integer) from public, anon;
grant execute on function public.gestao_receber_os(uuid, text, uuid, date, integer) to authenticated;
