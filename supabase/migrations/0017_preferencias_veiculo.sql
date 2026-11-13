-- Sempre Zero — Preferências do cliente para o veículo
-- Execute no Supabase depois do 0016: SQL Editor > New query > cole > Run
--
-- Ex.: "Não mexer nos bancos", "Não passar cheirinho", "Pretinho semi brilho".
-- Aparecem como ponto de atenção ao abrir a OS daquele veículo.
--   * veiculos.preferencias: as preferências de cada veículo.
--   * clientes.preferencias_padrao: preferências que entram sozinhas nos próximos veículos do cliente.

alter table public.veiculos
  add column if not exists preferencias text[] not null default '{}'
  check (cardinality(preferencias) <= 30);

alter table public.clientes
  add column if not exists preferencias_padrao text[] not null default '{}'
  check (cardinality(preferencias_padrao) <= 30);

-- Veículo novo sem preferências: recebe as preferências padrão do cliente.
-- (O nome começa com "zz" para rodar depois do gatilho que liga o veículo à ficha do cliente.)
create or replace function public.preferencias_padrao_do_veiculo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if cardinality(new.preferencias) = 0 and new.cliente_id is not null then
    new.preferencias := coalesce((select preferencias_padrao from public.clientes where id = new.cliente_id), '{}');
  end if;
  return new;
end;
$$;

drop trigger if exists veiculos_zz_preferencias_padrao on public.veiculos;
create trigger veiculos_zz_preferencias_padrao
  before insert on public.veiculos
  for each row execute function public.preferencias_padrao_do_veiculo();

-- Salva as preferências padrão do cliente dono do veículo (o próprio cliente ou a empresa).
create or replace function public.salvar_preferencias_padrao(p_veiculo uuid, p_preferencias text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.pode_acessar_veiculo(p_veiculo) then
    raise exception 'Sem permissão para este veículo.';
  end if;
  if cardinality(p_preferencias) > 30 then
    raise exception 'Preferências demais.';
  end if;
  update public.clientes
     set preferencias_padrao = coalesce(p_preferencias, '{}')
   where id = (select cliente_id from public.veiculos where id = p_veiculo);
end;
$$;

revoke execute on function public.salvar_preferencias_padrao(uuid, text[]) from public, anon;
grant execute on function public.salvar_preferencias_padrao(uuid, text[]) to authenticated;
revoke execute on function public.preferencias_padrao_do_veiculo() from public, anon, authenticated;
