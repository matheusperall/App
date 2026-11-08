-- Sempre Zero — instalação completa do banco (para um projeto Supabase NOVO)
-- Cole TUDO no SQL Editor do Supabase e clique em Run. Rode apenas uma vez.
-- Se o banco já existe, rode só os arquivos novos de supabase/migrations.

-- Sempre Zero — Etapa 1: perfis de usuário (cliente / admin)
-- Execute no Supabase: SQL Editor > New query > cole este arquivo > Run

-- Tipo de usuário
create type public.papel_usuario as enum ('cliente', 'admin');

-- Perfil de cada pessoa que tem conta (1 para 1 com auth.users)
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  telefone text,
  email text,
  papel public.papel_usuario not null default 'cliente',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.perfis is 'Dados de cada usuário do app. papel = cliente ou admin.';

-- Verifica se o usuário logado é administrador.
-- security definer: lê a tabela sem passar pelas regras de RLS (evita recursão).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel = 'admin'
  );
$$;

-- Cria o perfil automaticamente quando alguém cria conta (ou é convidado)
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome, telefone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    new.raw_user_meta_data ->> 'telefone',
    new.email
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- Mantém atualizado_em em dia
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger perfis_atualizado_em
  before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

-- Segurança (Row Level Security)
alter table public.perfis enable row level security;

create policy "Usuário vê o próprio perfil; admin vê todos"
  on public.perfis for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Usuário edita o próprio perfil; admin edita todos"
  on public.perfis for update
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- O cliente só pode alterar nome e telefone (nunca o próprio papel).
revoke update on public.perfis from authenticated, anon;
grant update (nome, telefone) on public.perfis to authenticated;

-- Para tornar uma conta administradora (rode depois de criar sua conta no app):
-- update public.perfis set papel = 'admin' where email = 'seu-email@exemplo.com';

-- Sempre Zero — Etapa 2: garagem (veículos, histórico de serviços, manutenções, fotos)
-- Execute no Supabase depois do 0001: SQL Editor > New query > cole > Run

-- ---------------------------------------------------------------------------
-- Veículos
-- ---------------------------------------------------------------------------
create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references public.perfis (id) on delete cascade,
  placa text not null,
  marca text not null default '',
  modelo text not null default '',
  ano integer,
  cor text,
  apelido text,
  km_atual integer not null default 0 check (km_atual >= 0),
  km_atualizado_em timestamptz not null default now(),
  foto text, -- caminho no Storage (bucket "fotos")
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index veiculos_placa_unica on public.veiculos (upper(placa));
create index veiculos_dono on public.veiculos (dono_id);

create trigger veiculos_atualizado_em
  before update on public.veiculos
  for each row execute function public.tocar_atualizado_em();

-- Quem pode mexer no veículo: o dono ou a empresa (admin)
create or replace function public.pode_acessar_veiculo(v_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.veiculos where id = v_id and dono_id = (select auth.uid())
  );
$$;

alter table public.veiculos enable row level security;

create policy "Ver veículos" on public.veiculos for select to authenticated
  using (dono_id = (select auth.uid()) or (select public.is_admin()));
create policy "Cadastrar veículos" on public.veiculos for insert to authenticated
  with check (dono_id = (select auth.uid()) or (select public.is_admin()));
create policy "Editar veículos" on public.veiculos for update to authenticated
  using (dono_id = (select auth.uid()) or (select public.is_admin()))
  with check (dono_id = (select auth.uid()) or (select public.is_admin()));
create policy "Excluir veículos" on public.veiculos for delete to authenticated
  using (dono_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Histórico de serviços
-- ---------------------------------------------------------------------------
create table public.servicos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos (id) on delete cascade,
  data date not null default current_date,
  categoria text not null check (categoria in
    ('estetica', 'funilaria_pintura', 'mecanica', 'eletrica', 'acessorios', 'outros')),
  titulo text not null,
  descricao text,
  km integer check (km >= 0),
  valor numeric(10, 2) check (valor >= 0),
  prestador text not null default 'proprio' check (prestador in ('proprio', 'terceirizado', 'externo')),
  fotos text[] not null default '{}', -- caminhos no Storage
  pela_empresa boolean not null default false, -- true = registrado pela Sempre Zero
  registrado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);

create index servicos_veiculo on public.servicos (veiculo_id, data desc);

-- pela_empresa só pode ser true quando quem registra é admin
create or replace function public.ajustar_servico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.registrado_por := auth.uid();
  new.pela_empresa := public.is_admin();
  if not new.pela_empresa then
    new.prestador := 'externo';
  end if;
  return new;
end;
$$;

create trigger servicos_ajustar
  before insert on public.servicos
  for each row execute function public.ajustar_servico();

alter table public.servicos enable row level security;

create policy "Ver serviços" on public.servicos for select to authenticated
  using ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Registrar serviços" on public.servicos for insert to authenticated
  with check ((select public.pode_acessar_veiculo(veiculo_id)));
-- O cliente só edita/exclui o que ele mesmo registrou; a empresa edita tudo.
create policy "Editar serviços" on public.servicos for update to authenticated
  using ((select public.is_admin()) or (registrado_por = (select auth.uid()) and not pela_empresa))
  with check ((select public.is_admin()) or (
    registrado_por = (select auth.uid()) and not pela_empresa and (select public.pode_acessar_veiculo(veiculo_id))
  ));
create policy "Excluir serviços" on public.servicos for delete to authenticated
  using ((select public.is_admin()) or (registrado_por = (select auth.uid()) and not pela_empresa));

-- ---------------------------------------------------------------------------
-- Manutenções periódicas (troca de óleo, alinhamento, ...)
-- ---------------------------------------------------------------------------
create table public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos (id) on delete cascade,
  tipo text not null,
  ultima_data date,
  ultimo_km integer,
  intervalo_meses integer check (intervalo_meses > 0),
  intervalo_km integer check (intervalo_km > 0),
  proxima_data date,
  proximo_km integer,
  definido_pela_empresa boolean not null default false,
  atualizado_em timestamptz not null default now(),
  unique (veiculo_id, tipo)
);

create trigger manutencoes_atualizado_em
  before update on public.manutencoes
  for each row execute function public.tocar_atualizado_em();

alter table public.manutencoes enable row level security;

create policy "Ver manutenções" on public.manutencoes for select to authenticated
  using ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Criar manutenções" on public.manutencoes for insert to authenticated
  with check ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Editar manutenções" on public.manutencoes for update to authenticated
  using ((select public.pode_acessar_veiculo(veiculo_id)))
  with check ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Excluir manutenções" on public.manutencoes for delete to authenticated
  using ((select public.pode_acessar_veiculo(veiculo_id)));

-- ---------------------------------------------------------------------------
-- Fotos (Storage). Caminho: <id do dono>/<id do veículo>/<arquivo>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Ver fotos" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
create policy "Enviar fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
create policy "Excluir fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

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

