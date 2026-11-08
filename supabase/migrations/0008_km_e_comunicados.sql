-- Sempre Zero — Ritmo de uso (km por dia) e comunicados para os clientes
-- Execute no Supabase depois do 0007: SQL Editor > New query > cole > Run

-- ---------------------------------------------------------------------------
-- Leituras de quilometragem (histórico do hodômetro)
-- origem: cadastro | cliente (informou no app) | servico (registrado num serviço) | empresa
-- ---------------------------------------------------------------------------
create table public.leituras_km (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos (id) on delete cascade,
  km integer not null check (km >= 0),
  data date not null default current_date,
  origem text not null default 'cliente' check (origem in ('cadastro', 'cliente', 'servico', 'empresa')),
  criado_em timestamptz not null default now()
);

create index leituras_km_veiculo on public.leituras_km (veiculo_id, data);

alter table public.leituras_km enable row level security;

create policy "Ver leituras" on public.leituras_km for select to authenticated
  using ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Registrar leituras" on public.leituras_km for insert to authenticated
  with check ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Excluir leituras (empresa)" on public.leituras_km for delete to authenticated
  using ((select public.is_admin()));

-- Ritmo de uso calculado (km por dia) — usado para prever quando o km da manutenção será atingido
alter table public.veiculos
  add column if not exists km_por_dia numeric(8, 2),
  add column if not exists ritmo_calculado_em timestamptz;

-- Histórico inicial: km atual dos veículos e km dos serviços já registrados
insert into public.leituras_km (veiculo_id, km, data, origem)
select id, km_atual, (km_atualizado_em at time zone 'America/Sao_Paulo')::date, 'cadastro'
from public.veiculos
where km_atual > 0;

insert into public.leituras_km (veiculo_id, km, data, origem)
select veiculo_id, km, data, 'servico'
from public.servicos
where km is not null;

-- ---------------------------------------------------------------------------
-- Comunicados (novidades, promoções, lembretes, oportunidades) enviados a todos
-- ---------------------------------------------------------------------------
create table public.comunicados (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('novidade', 'promocao', 'lembrete', 'oportunidade')),
  titulo text not null,
  mensagem text not null,
  link text,
  por_email boolean not null default false,
  destinatarios integer not null default 0,
  enviado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

alter table public.comunicados enable row level security;

create policy "Empresa vê comunicados" on public.comunicados for select to authenticated
  using ((select public.is_admin()));
create policy "Empresa cria comunicados" on public.comunicados for insert to authenticated
  with check ((select public.is_admin()));
