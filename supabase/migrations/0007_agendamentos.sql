-- Sempre Zero — Etapa 6: agendamentos (com Google Agenda)
-- Execute no Supabase depois do 0006: SQL Editor > New query > cole > Run

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos (id) on delete cascade,
  tipo text not null check (tipo in ('lavagem', 'servico')),
  servico text not null, -- ex.: "Lavagem", "Polimento técnico"
  categoria text not null default 'outros' check (categoria in
    ('estetica', 'funilaria_pintura', 'mecanica', 'eletrica', 'acessorios', 'outros')),
  -- solicitado (cliente sugeriu horários) → confirmado → concluido ; recusado ; cancelado
  situacao text not null default 'solicitado' check (situacao in
    ('solicitado', 'confirmado', 'concluido', 'recusado', 'cancelado')),
  inicio timestamptz, -- definido na confirmação (ou na escolha do horário da lavagem)
  fim timestamptz,
  preferencias jsonb not null default '[]', -- [{ "data": "2026-11-20", "periodo": "manha" }]
  observacoes text, -- mensagem do cliente
  resposta text, -- mensagem da empresa
  orcamento_id uuid references public.orcamentos (id) on delete set null,
  apontamento_id uuid references public.apontamentos (id) on delete set null,
  google_evento_id text,
  solicitado_por uuid references public.perfis (id) on delete set null,
  confirmado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or inicio is null or fim > inicio)
);

create index agendamentos_veiculo on public.agendamentos (veiculo_id, criado_em desc);
create index agendamentos_inicio on public.agendamentos (inicio) where situacao = 'confirmado';
create index agendamentos_situacao on public.agendamentos (situacao);

create trigger agendamentos_atualizado_em
  before update on public.agendamentos
  for each row execute function public.tocar_atualizado_em();

-- O cliente só cria pedidos e cancela os próprios. A lavagem com horário escolhido
-- é gravada pelo servidor do app (que confere a disponibilidade) e chega aqui confirmada.
create or replace function public.validar_agendamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new; -- empresa ou servidor do app
  end if;

  if tg_op = 'INSERT' then
    new.situacao := 'solicitado';
    new.inicio := null;
    new.fim := null;
    new.resposta := null;
    new.google_evento_id := null;
    new.confirmado_em := null;
    new.solicitado_por := auth.uid();
    return new;
  end if;

  if new.situacao <> 'cancelado' or old.situacao not in ('solicitado', 'confirmado')
     or new.inicio is distinct from old.inicio or new.fim is distinct from old.fim
     or new.veiculo_id <> old.veiculo_id then
    raise exception 'Somente a empresa pode alterar o agendamento.';
  end if;
  return new;
end;
$$;

create trigger agendamentos_validar
  before insert or update on public.agendamentos
  for each row execute function public.validar_agendamento();

alter table public.agendamentos enable row level security;

create policy "Ver agendamentos" on public.agendamentos for select to authenticated
  using ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Pedir agendamento" on public.agendamentos for insert to authenticated
  with check ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Atualizar agendamento" on public.agendamentos for update to authenticated
  using ((select public.pode_acessar_veiculo(veiculo_id)))
  with check ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Excluir agendamento (empresa)" on public.agendamentos for delete to authenticated
  using ((select public.is_admin()));
