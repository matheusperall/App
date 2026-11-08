-- Sempre Zero — Etapa 3: apontamentos, avisos (notificações) e inscrições de push
-- Execute no Supabase depois do 0002: SQL Editor > New query > cole > Run

-- ---------------------------------------------------------------------------
-- Apontamentos: o que a oficina identificou e precisa de atenção no veículo
-- ---------------------------------------------------------------------------
create table public.apontamentos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos (id) on delete cascade,
  categoria text not null check (categoria in
    ('estetica', 'funilaria_pintura', 'mecanica', 'eletrica', 'acessorios', 'outros')),
  titulo text not null,
  descricao text,
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'urgente')),
  fotos text[] not null default '{}',
  -- pendente: aguardando o cliente
  -- orcamento: cliente pediu orçamento | agendamento: cliente quer agendar
  -- agendado: empresa confirmou | concluido: feito | recusado: cliente não quer agora
  situacao text not null default 'pendente' check (situacao in
    ('pendente', 'orcamento', 'agendamento', 'agendado', 'concluido', 'recusado')),
  mensagem_cliente text,
  respondido_em timestamptz,
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index apontamentos_veiculo on public.apontamentos (veiculo_id, criado_em desc);
create index apontamentos_situacao on public.apontamentos (situacao);

create trigger apontamentos_atualizado_em
  before update on public.apontamentos
  for each row execute function public.tocar_atualizado_em();

-- O cliente só pode responder (situação + mensagem), e só com respostas de cliente.
create or replace function public.validar_resposta_apontamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.veiculo_id <> old.veiculo_id or new.categoria <> old.categoria or new.titulo <> old.titulo
     or new.descricao is distinct from old.descricao or new.prioridade <> old.prioridade
     or new.fotos <> old.fotos or new.criado_por is distinct from old.criado_por then
    raise exception 'Somente a empresa pode alterar o apontamento.';
  end if;
  if new.situacao not in ('orcamento', 'agendamento', 'recusado', 'pendente') then
    raise exception 'Resposta inválida.';
  end if;
  new.respondido_em := now();
  return new;
end;
$$;

create trigger apontamentos_validar_resposta
  before update on public.apontamentos
  for each row execute function public.validar_resposta_apontamento();

alter table public.apontamentos enable row level security;

create policy "Ver apontamentos" on public.apontamentos for select to authenticated
  using ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Criar apontamentos (empresa)" on public.apontamentos for insert to authenticated
  with check ((select public.is_admin()));
create policy "Responder apontamentos" on public.apontamentos for update to authenticated
  using ((select public.pode_acessar_veiculo(veiculo_id)))
  with check ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Excluir apontamentos (empresa)" on public.apontamentos for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Avisos (central de notificações dentro do app)
-- ---------------------------------------------------------------------------
create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  titulo text not null,
  corpo text,
  link text,
  lida_em timestamptz,
  criado_em timestamptz not null default now()
);

create index notificacoes_usuario on public.notificacoes (usuario_id, criado_em desc);

alter table public.notificacoes enable row level security;

-- Cada um vê e marca como lidas as suas. A criação é feita pelo servidor do app.
create policy "Ver meus avisos" on public.notificacoes for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy "Marcar meus avisos" on public.notificacoes for update to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "Apagar meus avisos" on public.notificacoes for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Inscrições de notificação no celular (Web Push), uma por aparelho
-- ---------------------------------------------------------------------------
create table public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  aparelho text,
  criado_em timestamptz not null default now()
);

create index push_inscricoes_usuario on public.push_inscricoes (usuario_id);

alter table public.push_inscricoes enable row level security;

create policy "Minhas inscrições" on public.push_inscricoes for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
