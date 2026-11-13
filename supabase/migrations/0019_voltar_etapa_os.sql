-- Sempre Zero — Voltar etapa da ordem de serviço
-- Execute no Supabase depois do 0018: SQL Editor > New query > cole > Run
--
-- Agora dá para voltar a OS uma etapa (ex.: de "pronta" para "em andamento"). Quando ela volta de "pronta",
-- os produtos que saíram do estoque voltam. Esta versão devolve só o que ainda não foi devolvido,
-- então a OS pode ir e voltar várias vezes sem contar o estoque em dobro.

create or replace function public.gestao_estornar_estoque_os(p_os uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_numero bigint;
  r record;
  v_saldo numeric;
begin
  if not public.is_admin() then
    raise exception 'Somente a empresa pode fazer isso.';
  end if;

  select numero into v_numero from public.ordens_servico
   where id = p_os and estoque_baixado for update;
  if v_numero is null then
    return;
  end if;

  -- Saldo líquido desta OS por produto: baixas (negativas) + devoluções já feitas (positivas)
  for r in
    select produto_id, -sum(quantidade) as qtd, max(custo_unitario) filter (where tipo = 'baixa') as custo
      from public.estoque_movimentos
     where os_id = p_os
       and (tipo = 'baixa' or (tipo = 'ajuste' and origem like 'Estorno OS #%'))
     group by produto_id
    having -sum(quantidade) > 0
  loop
    update public.produtos set saldo = saldo + r.qtd where id = r.produto_id returning saldo into v_saldo;
    insert into public.estoque_movimentos (produto_id, tipo, quantidade, custo_unitario, saldo_apos, origem, os_id)
    values (r.produto_id, 'ajuste', r.qtd, r.custo, v_saldo, 'Estorno OS #' || v_numero, p_os);
  end loop;

  update public.ordens_servico set estoque_baixado = false, custo_produtos = 0 where id = p_os;
end;
$$;

revoke execute on function public.gestao_estornar_estoque_os(uuid) from public, anon;
grant execute on function public.gestao_estornar_estoque_os(uuid) to authenticated;
