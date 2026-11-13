-- Sempre Zero — Tamanho do veículo e preço dos serviços por tamanho
-- Execute no Supabase depois do 0019: SQL Editor > New query > cole > Run
--
-- Tamanhos: pequeno → médio → grande → extra (o preço sobe nessa ordem).
--   * veiculos.porte: o tamanho de cada carro.
--   * catalogo_servicos.precos_porte: preço de cada tamanho, ex.: {"pequeno": 140, "medio": 150, "grande": 170, "extra": 200}.
--     Tamanho sem preço usa o preço normal do serviço.

alter table public.veiculos
  add column if not exists porte text check (porte is null or porte in ('pequeno', 'medio', 'grande', 'extra'));

alter table public.catalogo_servicos
  add column if not exists precos_porte jsonb not null default '{}'::jsonb check (jsonb_typeof(precos_porte) = 'object');

-- Limpeza padrão: tabela usada desde julho/2026
update public.catalogo_servicos
   set precos_porte = '{"pequeno": 140, "medio": 150, "grande": 170, "extra": 200}'::jsonb,
       preco = 140
 where lower(nome) = 'limpeza padrão' and precos_porte = '{}'::jsonb;

-- Tamanho dos carros pelo histórico: a Limpeza padrão mais recente (de julho/2026 em diante) com um dos 4 valores
update public.veiculos v
   set porte = x.porte
  from (
    select distinct on (o.veiculo_id) o.veiculo_id,
           case i.preco when 140 then 'pequeno' when 150 then 'medio' when 170 then 'grande' when 200 then 'extra' end as porte
      from public.os_itens i
      join public.ordens_servico o on o.id = i.os_id
     where lower(i.nome) = 'limpeza padrão'
       and o.data >= '2026-07-01'
       and o.status <> 'cancelada'
       and i.preco in (140, 150, 170, 200)
       and o.veiculo_id is not null
     order by o.veiculo_id, o.data desc, o.numero desc
  ) x
 where v.id = x.veiculo_id and v.porte is null;

-- Conferência: quantos carros ficaram com cada tamanho
select coalesce(porte, 'sem tamanho') as tamanho, count(*) from public.veiculos group by 1 order by 1;
