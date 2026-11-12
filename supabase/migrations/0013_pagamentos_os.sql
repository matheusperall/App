-- Sempre Zero — OS paga em vários pagamentos (ex.: parte no Pix e parte no crédito) ou em partes
-- Execute no Supabase depois do 0012: SQL Editor > New query > cole > Run

-- Quanto já foi pago da OS (a OS fica "paga" quando chega ao total)
alter table public.ordens_servico
  add column if not exists valor_pago numeric(12, 2) not null default 0;

update public.ordens_servico set valor_pago = total where pago and valor_pago = 0;

-- Cada pagamento recebido numa OS
create table if not exists public.os_pagamentos (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references public.ordens_servico (id) on delete cascade,
  data date not null default current_date,
  valor numeric(12, 2) not null check (valor > 0),
  forma text not null check (forma in ('pix', 'dinheiro', 'debito', 'credito', 'transferencia')),
  conta_id uuid references public.contas (id) on delete set null,
  parcelas integer check (parcelas between 1 and 24),
  taxa_valor numeric(12, 2) not null default 0,
  lancamento_id uuid references public.lancamentos (id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists os_pagamentos_os on public.os_pagamentos (os_id);

alter table public.os_pagamentos enable row level security;
drop policy if exists "Somente a empresa" on public.os_pagamentos;
create policy "Somente a empresa" on public.os_pagamentos for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Pagamentos que já existem (OS avulsas recebidas antes desta atualização)
insert into public.os_pagamentos (os_id, data, valor, forma, conta_id, parcelas, taxa_valor)
select os.id, coalesce(os.pago_em, os.data), os.total, os.forma_pagamento, os.conta_id, os.parcelas, os.taxa_valor
  from public.ordens_servico os
 where os.pago and os.fatura_id is null and os.forma_pagamento is not null and os.total > 0
   and not exists (select 1 from public.os_pagamentos p where p.os_id = os.id);

-- Recebe um ou mais pagamentos de uma OS avulsa.
-- p_pagamentos: [{ "valor": 100, "forma": "pix", "conta_id": "...", "parcelas": 1 }, ...]
-- A soma pode ser menor que o que falta (o resto fica em aberto), mas nunca maior.
create or replace function public.gestao_receber_os_pagamentos(p_os uuid, p_pagamentos jsonb, p_data date default current_date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  o record;
  k record;
  pg jsonb;
  v_valor numeric;
  v_forma text;
  v_conta uuid;
  v_parcelas integer;
  v_taxa_pct numeric;
  v_taxa numeric;
  v_rotulo text;
  v_lanc uuid;
  v_soma numeric := 0;
  v_taxas numeric := 0;
  v_primeira jsonb;
begin
  if not public.is_admin() then
    raise exception 'Somente a empresa pode fazer isso.';
  end if;
  if p_pagamentos is null or jsonb_typeof(p_pagamentos) <> 'array' or jsonb_array_length(p_pagamentos) = 0 then
    raise exception 'Informe pelo menos um pagamento.';
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

  select coalesce(sum((x ->> 'valor')::numeric), 0) into v_soma from jsonb_array_elements(p_pagamentos) x;
  if v_soma <= 0 then
    raise exception 'Informe o valor recebido.';
  end if;
  if v_soma > o.total - o.valor_pago + 0.001 then
    raise exception 'Os pagamentos somam mais do que falta receber (%).', replace(to_char(o.total - o.valor_pago, 'FM999999990.00'), '.', ',');
  end if;

  for pg in select * from jsonb_array_elements(p_pagamentos) loop
    v_valor := round((pg ->> 'valor')::numeric, 2);
    v_forma := pg ->> 'forma';
    v_conta := (pg ->> 'conta_id')::uuid;
    v_parcelas := coalesce((pg ->> 'parcelas')::integer, 1);
    if v_valor is null or v_valor <= 0 then
      raise exception 'Cada pagamento precisa de um valor.';
    end if;
    if v_forma not in ('pix', 'dinheiro', 'debito', 'credito', 'transferencia') then
      raise exception 'Forma de pagamento inválida.';
    end if;
    select * into k from public.contas where id = v_conta;
    if k is null then
      raise exception 'Escolha a conta de cada pagamento.';
    end if;
    if not (v_forma = any (k.formas)) then
      raise exception 'A conta % não recebe nesta forma de pagamento.', k.nome;
    end if;

    if v_forma <> 'credito' then
      v_parcelas := 1;
    end if;
    v_taxa_pct := 0;
    if v_forma = 'pix' then
      v_taxa_pct := k.taxa_pix;
    elsif v_forma = 'debito' then
      v_taxa_pct := k.taxa_debito;
    elsif v_forma = 'credito' and v_parcelas = 1 then
      v_taxa_pct := k.taxa_credito;
    elsif v_forma = 'credito' then
      if not (k.taxas_parcelado ? v_parcelas::text) then
        raise exception 'A conta % não aceita crédito em % vezes.', k.nome, v_parcelas;
      end if;
      v_taxa_pct := (k.taxas_parcelado ->> v_parcelas::text)::numeric;
    end if;
    v_taxa := round(v_valor * coalesce(v_taxa_pct, 0) / 100, 2);
    v_rotulo := case v_forma
      when 'pix' then 'Pix'
      when 'debito' then 'débito'
      when 'credito' then 'crédito' || case when v_parcelas > 1 then ' ' || v_parcelas || 'x' else '' end
      else v_forma end;

    insert into public.lancamentos (data, tipo, descricao, valor, categoria_id, conta_id, pago, pago_em, os_id)
    values (p_data, 'entrada', 'OS #' || o.numero || coalesce(' · ' || o.placa, ''), v_valor,
            (select id from public.categorias_financeiras where sistema = 'os'), v_conta, true, p_data, p_os)
    returning id into v_lanc;
    if v_taxa > 0 then
      insert into public.lancamentos (data, tipo, descricao, valor, categoria_id, conta_id, pago, pago_em, os_id)
      values (p_data, 'saida', 'Taxa ' || v_rotulo || ' · OS #' || o.numero, v_taxa,
              (select id from public.categorias_financeiras where sistema = 'taxa'), v_conta, true, p_data, p_os);
    end if;

    insert into public.os_pagamentos (os_id, data, valor, forma, conta_id, parcelas, taxa_valor, lancamento_id)
    values (p_os, p_data, v_valor, v_forma, v_conta, case when v_forma = 'credito' then v_parcelas else null end, v_taxa, v_lanc);
    v_taxas := v_taxas + v_taxa;
  end loop;

  v_primeira := p_pagamentos -> 0;
  update public.ordens_servico
     set valor_pago = valor_pago + v_soma,
         taxa_valor = taxa_valor + v_taxas,
         pago = (valor_pago + v_soma) >= total - 0.001,
         pago_em = case when (valor_pago + v_soma) >= total - 0.001 then p_data else pago_em end,
         forma_pagamento = coalesce(forma_pagamento, v_primeira ->> 'forma'),
         conta_id = coalesce(conta_id, (v_primeira ->> 'conta_id')::uuid),
         parcelas = coalesce(parcelas, case when v_primeira ->> 'forma' = 'credito' then coalesce((v_primeira ->> 'parcelas')::integer, 1) end)
   where id = p_os;
end;
$$;

revoke execute on function public.gestao_receber_os_pagamentos(uuid, jsonb, date) from public, anon;
grant execute on function public.gestao_receber_os_pagamentos(uuid, jsonb, date) to authenticated;

-- O recebimento antigo (um pagamento só) passa a usar o novo
create or replace function public.gestao_receber_os(p_os uuid, p_forma text, p_conta uuid, p_data date default current_date, p_parcelas integer default 1)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_falta numeric;
begin
  select total - valor_pago into v_falta from public.ordens_servico where id = p_os;
  perform public.gestao_receber_os_pagamentos(
    p_os,
    jsonb_build_array(jsonb_build_object('valor', v_falta, 'forma', p_forma, 'conta_id', p_conta, 'parcelas', p_parcelas)),
    p_data
  );
end;
$$;
