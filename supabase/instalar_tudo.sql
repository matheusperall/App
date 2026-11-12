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

-- Sempre Zero — Dados da tabela FIPE no veículo
-- Execute no Supabase depois do 0003: SQL Editor > New query > cole > Run

alter table public.veiculos
  add column if not exists tipo text not null default 'carro' check (tipo in ('carro', 'moto', 'caminhao')),
  add column if not exists combustivel text,
  add column if not exists codigo_fipe text,
  add column if not exists valor_fipe numeric(12, 2),
  add column if not exists fipe_referencia text, -- mês de referência, ex.: "novembro de 2026"
  add column if not exists fipe_marca_cod text,
  add column if not exists fipe_modelo_cod text,
  add column if not exists fipe_ano_cod text;

-- Sempre Zero — Etapa 4: documentos/vencimentos e controle dos lembretes automáticos
-- Execute no Supabase depois do 0004: SQL Editor > New query > cole > Run

-- ---------------------------------------------------------------------------
-- Documentos e vencimentos (licenciamento, IPVA, seguro, CNH...)
-- veiculo_id vazio = documento da pessoa (ex.: CNH)
-- ---------------------------------------------------------------------------
create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references public.perfis (id) on delete cascade,
  veiculo_id uuid references public.veiculos (id) on delete cascade,
  tipo text not null check (tipo in ('licenciamento', 'ipva', 'seguro', 'cnh', 'outro')),
  descricao text, -- ex.: nome da seguradora, categoria da CNH
  vencimento date not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Um de cada tipo por veículo (e uma CNH por pessoa)
create unique index documentos_unico on public.documentos
  (dono_id, coalesce(veiculo_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo)
  where tipo <> 'outro';
create index documentos_vencimento on public.documentos (vencimento);

create trigger documentos_atualizado_em
  before update on public.documentos
  for each row execute function public.tocar_atualizado_em();

alter table public.documentos enable row level security;

create policy "Ver documentos" on public.documentos for select to authenticated
  using (dono_id = (select auth.uid()) or (select public.is_admin()));
create policy "Criar documentos" on public.documentos for insert to authenticated
  with check (
    (dono_id = (select auth.uid()) or (select public.is_admin()))
    and (veiculo_id is null or (select public.pode_acessar_veiculo(veiculo_id)))
  );
create policy "Editar documentos" on public.documentos for update to authenticated
  using (dono_id = (select auth.uid()) or (select public.is_admin()))
  with check (dono_id = (select auth.uid()) or (select public.is_admin()));
create policy "Excluir documentos" on public.documentos for delete to authenticated
  using (dono_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Registro dos lembretes já enviados (evita mandar o mesmo aviso duas vezes)
-- Só o servidor do app (chave service_role) lê e escreve aqui.
-- ---------------------------------------------------------------------------
create table public.lembretes_enviados (
  chave text primary key,
  usuario_id uuid references public.perfis (id) on delete cascade,
  enviado_em timestamptz not null default now()
);

alter table public.lembretes_enviados enable row level security;
-- (sem políticas: nenhum usuário acessa diretamente)

-- Sempre Zero — Etapa 5: orçamentos
-- Execute no Supabase depois do 0005: SQL Editor > New query > cole > Run

create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity, -- número amigável: Orçamento #12
  veiculo_id uuid not null references public.veiculos (id) on delete cascade,
  apontamento_id uuid references public.apontamentos (id) on delete set null,
  solicitado_por uuid references public.perfis (id) on delete set null,
  categoria text not null default 'outros' check (categoria in
    ('estetica', 'funilaria_pintura', 'mecanica', 'eletrica', 'acessorios', 'outros')),
  pedido text, -- o que o cliente pediu
  fotos text[] not null default '{}',
  -- solicitado → respondido → aceito | recusado ; cancelado (cliente desistiu antes da resposta)
  situacao text not null default 'solicitado' check (situacao in
    ('solicitado', 'respondido', 'aceito', 'recusado', 'cancelado')),
  itens jsonb not null default '[]', -- [{ "descricao": "...", "valor": 123.45 }]
  valor_total numeric(12, 2),
  prazo_dias integer check (prazo_dias >= 0),
  validade date,
  observacoes text,
  motivo_recusa text,
  respondido_em timestamptz,
  decidido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index orcamentos_veiculo on public.orcamentos (veiculo_id, criado_em desc);
create index orcamentos_situacao on public.orcamentos (situacao);

create trigger orcamentos_atualizado_em
  before update on public.orcamentos
  for each row execute function public.tocar_atualizado_em();

-- Regras do lado do cliente: ele só pede, cancela o próprio pedido, ou aceita/recusa a resposta.
create or replace function public.validar_orcamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.situacao := 'solicitado';
    new.solicitado_por := auth.uid();
    new.itens := '[]';
    new.valor_total := null;
    new.prazo_dias := null;
    new.validade := null;
    new.observacoes := null;
    new.respondido_em := null;
    new.decidido_em := null;
    return new;
  end if;

  -- UPDATE pelo cliente
  if new.veiculo_id <> old.veiculo_id or new.itens <> old.itens
     or new.valor_total is distinct from old.valor_total or new.prazo_dias is distinct from old.prazo_dias
     or new.validade is distinct from old.validade or new.observacoes is distinct from old.observacoes
     or new.pedido is distinct from old.pedido or new.fotos <> old.fotos then
    raise exception 'Somente a empresa pode alterar o orçamento.';
  end if;
  if not (
    (old.situacao = 'respondido' and new.situacao in ('aceito', 'recusado'))
    or (old.situacao = 'solicitado' and new.situacao = 'cancelado')
  ) then
    raise exception 'Ação não permitida para este orçamento.';
  end if;
  new.decidido_em := now();
  return new;
end;
$$;

create trigger orcamentos_validar
  before insert or update on public.orcamentos
  for each row execute function public.validar_orcamento();

alter table public.orcamentos enable row level security;

create policy "Ver orçamentos" on public.orcamentos for select to authenticated
  using ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Pedir orçamento" on public.orcamentos for insert to authenticated
  with check ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Atualizar orçamento" on public.orcamentos for update to authenticated
  using ((select public.pode_acessar_veiculo(veiculo_id)))
  with check ((select public.pode_acessar_veiculo(veiculo_id)));
create policy "Excluir orçamento (empresa)" on public.orcamentos for delete to authenticated
  using ((select public.is_admin()));

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

-- Sempre Zero — Estado (UF) de registro do veículo, para os calendários de IPVA e licenciamento
-- Execute no Supabase depois do 0008: SQL Editor > New query > cole > Run

alter table public.veiculos
  add column if not exists uf char(2) not null default 'SP';

-- Sempre Zero — Gestão da loja (ordens de serviço, catálogo, estoque, financeiro e faturas de lojistas)
-- Execute no Supabase depois do 0009: SQL Editor > New query > cole > Run
--
-- Resumo da modelagem de clientes:
--   * "clientes" é a ficha do cliente na loja. Pode existir SEM conta no app (só nome e telefone).
--   * Quem tem conta no app continua tendo o seu "perfil" (perfis); a ficha aponta para ele em clientes.perfil_id.
--   * Cada veículo passa a pertencer a uma ficha (veiculos.cliente_id). O campo antigo veiculos.dono_id
--     continua sendo o "dono com login" e é preenchido automaticamente a partir da ficha.
--     Veículo de cliente sem login fica com dono_id vazio: só a empresa enxerga.
--   * Quando o cliente recebe o convite e cria a conta, a ficha é ligada ao novo perfil e os veículos
--     passam a aparecer na garagem dele — sem cadastro duplicado.

-- ===========================================================================
-- 1. Fichas de clientes
-- ===========================================================================
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid unique references public.perfis (id) on delete set null, -- conta no app (opcional)
  nome text not null default '',
  telefone text,
  email text,
  lojista boolean not null default false, -- revenda de carros: paga por fatura mensal
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.clientes is 'Ficha do cliente na loja. perfil_id vazio = cliente sem login no app.';

create index clientes_nome on public.clientes (lower(nome));

create trigger clientes_atualizado_em
  before update on public.clientes
  for each row execute function public.tocar_atualizado_em();

alter table public.clientes enable row level security;

create policy "Empresa gerencia clientes" on public.clientes for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Devolve a ficha ligada a um perfil, criando-a se ainda não existir.
create or replace function public.garantir_cliente(p_perfil uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_perfil is null then
    return null;
  end if;
  select id into v_id from public.clientes where perfil_id = p_perfil;
  if v_id is null then
    insert into public.clientes (perfil_id, nome, telefone, email)
    select p.id, p.nome, p.telefone, p.email from public.perfis p where p.id = p_perfil
    on conflict (perfil_id) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.clientes where perfil_id = p_perfil;
    end if;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.garantir_cliente(uuid) from public, anon, authenticated;

-- Toda conta nova ganha a sua ficha (o cliente que se cadastra sozinho aparece na gestão).
create or replace function public.criar_ficha_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.garantir_cliente(new.id);
  return new;
end;
$$;

create trigger perfis_criar_ficha
  after insert on public.perfis
  for each row execute function public.criar_ficha_do_perfil();

-- Mantém nome e telefone da ficha iguais aos do perfil quando o cliente edita a própria conta.
create or replace function public.sincronizar_ficha_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clientes
     set nome = coalesce(nullif(new.nome, ''), nome),
         telefone = coalesce(new.telefone, telefone),
         email = coalesce(new.email, email)
   where perfil_id = new.id;
  return new;
end;
$$;

create trigger perfis_sincronizar_ficha
  after update of nome, telefone, email on public.perfis
  for each row execute function public.sincronizar_ficha_do_perfil();

-- Fichas para todas as contas que já existem
insert into public.clientes (perfil_id, nome, telefone, email)
select p.id, p.nome, p.telefone, p.email from public.perfis p
on conflict (perfil_id) do nothing;

-- ===========================================================================
-- 2. Veículos passam a pertencer a uma ficha
-- ===========================================================================
alter table public.veiculos add column if not exists cliente_id uuid references public.clientes (id) on delete cascade;
update public.veiculos v set cliente_id = c.id from public.clientes c where c.perfil_id = v.dono_id and v.cliente_id is null;
alter table public.veiculos alter column cliente_id set not null;
alter table public.veiculos alter column dono_id drop not null;
create index if not exists veiculos_cliente on public.veiculos (cliente_id);

-- Liga dono_id (login) e cliente_id (ficha) automaticamente.
-- Cliente comum: a ficha é sempre a dele (não consegue colocar veículo na ficha de outra pessoa).
create or replace function public.sincronizar_dono_veiculo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.cliente_id := public.garantir_cliente(new.dono_id);
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.cliente_id is not null then
      new.dono_id := (select perfil_id from public.clientes where id = new.cliente_id);
    else
      new.cliente_id := public.garantir_cliente(new.dono_id);
    end if;
  elsif new.cliente_id is distinct from old.cliente_id then
    new.dono_id := (select perfil_id from public.clientes where id = new.cliente_id);
  elsif new.dono_id is distinct from old.dono_id then
    new.cliente_id := public.garantir_cliente(new.dono_id);
  end if;

  if new.cliente_id is null then
    raise exception 'Informe o cliente do veículo.';
  end if;
  return new;
end;
$$;

create trigger veiculos_sincronizar_dono
  before insert or update of dono_id, cliente_id on public.veiculos
  for each row execute function public.sincronizar_dono_veiculo();

-- Documentos de veículos de clientes sem login (só a empresa vê) também precisam caber no banco
alter table public.documentos alter column dono_id drop not null;

-- Fotos de veículos de clientes sem login ficam na pasta "c-<id da ficha>".
-- Depois que o cliente ganha acesso, ele também passa a ver essas fotos.
create or replace function public.minha_pasta_ficha()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select 'c-' || id::text from public.clientes where perfil_id = (select auth.uid());
$$;

create policy "Ver fotos da minha ficha" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select public.minha_pasta_ficha()));

-- Liga uma ficha a uma conta do app (usado pelo servidor do app depois do convite).
-- Se a conta já tinha uma ficha própria, os veículos e o histórico dela vêm para esta ficha.
create or replace function public.vincular_cliente_perfil(p_cliente uuid, p_perfil uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outra uuid;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Somente a empresa pode fazer isso.';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente) then
    raise exception 'Cliente não encontrado.';
  end if;
  if exists (select 1 from public.clientes where id = p_cliente and perfil_id is not null and perfil_id <> p_perfil) then
    raise exception 'Esta ficha já está ligada a outra conta.';
  end if;

  select id into v_outra from public.clientes where perfil_id = p_perfil and id <> p_cliente;
  if v_outra is not null then
    update public.veiculos set cliente_id = p_cliente where cliente_id = v_outra;
    update public.ordens_servico set cliente_id = p_cliente where cliente_id = v_outra;
    update public.faturas set cliente_id = p_cliente where cliente_id = v_outra;
    delete from public.clientes where id = v_outra;
  end if;

  update public.clientes c
     set perfil_id = p_perfil,
         email = coalesce(c.email, p.email)
    from public.perfis p
   where c.id = p_cliente and p.id = p_perfil;

  -- Veículos e documentos da ficha passam a aparecer na garagem do cliente
  update public.veiculos set dono_id = p_perfil where cliente_id = p_cliente;
  update public.documentos set dono_id = p_perfil
   where veiculo_id in (select id from public.veiculos where cliente_id = p_cliente);
end;
$$;

revoke execute on function public.vincular_cliente_perfil(uuid, uuid) from public, anon;
grant execute on function public.vincular_cliente_perfil(uuid, uuid) to authenticated;

-- ===========================================================================
-- 3. Configurações da gestão (uma linha só)
-- ===========================================================================
create table public.gestao_config (
  id boolean primary key default true check (id),
  vagas_patio integer not null default 6 check (vagas_patio between 1 and 100),
  taxa_debito numeric(5, 2) not null default 1.99 check (taxa_debito >= 0),
  taxa_credito numeric(5, 2) not null default 3.49 check (taxa_credito >= 0),
  atualizado_em timestamptz not null default now()
);

insert into public.gestao_config default values;

alter table public.gestao_config enable row level security;
create policy "Empresa gerencia configurações" on public.gestao_config for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ===========================================================================
-- 4. Estoque
-- ===========================================================================
create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  unidade text not null default 'un' check (unidade in ('un', 'ml', 'l', 'g', 'kg')),
  saldo numeric(14, 3) not null default 0,
  minimo numeric(14, 3) not null default 0 check (minimo >= 0),
  custo_medio numeric(14, 4) not null default 0 check (custo_medio >= 0), -- custo de 1 unidade
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index produtos_nome_unico on public.produtos (lower(nome));

create trigger produtos_atualizado_em
  before update on public.produtos
  for each row execute function public.tocar_atualizado_em();

create table public.estoque_movimentos (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id) on delete cascade,
  criado_em timestamptz not null default now(),
  tipo text not null check (tipo in ('baixa', 'reposicao', 'ajuste')),
  quantidade numeric(14, 3) not null, -- positivo = entrou; negativo = saiu
  custo_unitario numeric(14, 4) not null default 0,
  saldo_apos numeric(14, 3) not null,
  origem text, -- ex.: "OS #12", "Compra", "Contagem"
  os_id uuid, -- ligada à OS (chave criada mais abaixo)
  observacao text
);

create index estoque_movimentos_produto on public.estoque_movimentos (produto_id, criado_em desc);

-- ===========================================================================
-- 5. Catálogo de serviços (o que a loja vende) — diferente de "servicos" (histórico do veículo)
-- ===========================================================================
create table public.catalogo_servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  preco numeric(12, 2) not null default 0 check (preco >= 0),
  categoria text not null default 'estetica' check (categoria in
    ('estetica', 'funilaria_pintura', 'mecanica', 'eletrica', 'acessorios', 'outros')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index catalogo_servicos_nome_unico on public.catalogo_servicos (lower(nome));

create trigger catalogo_servicos_atualizado_em
  before update on public.catalogo_servicos
  for each row execute function public.tocar_atualizado_em();

-- Produtos gastos em cada serviço (ex.: Lavagem gasta 50 ml de shampoo)
create table public.catalogo_consumo (
  id uuid primary key default gen_random_uuid(),
  servico_id uuid not null references public.catalogo_servicos (id) on delete cascade,
  produto_id uuid not null references public.produtos (id) on delete cascade,
  quantidade numeric(14, 3) not null check (quantidade > 0),
  unique (servico_id, produto_id)
);

-- ===========================================================================
-- 6. Financeiro: contas, categorias e lançamentos
-- ===========================================================================
create table public.contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'banco' check (tipo in ('banco', 'caixa', 'digital', 'outro')),
  saldo_inicial numeric(12, 2) not null default 0,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

-- dre: em qual linha do resultado (DRE) a categoria entra
--   receita (entradas), taxa (taxas de cartão), estoque (compra de produtos: vira estoque, não é despesa),
--   despesa (despesas da loja), fora (não entra no resultado: ex. aporte, transferência)
create table public.categorias_financeiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  dre text not null default 'despesa' check (dre in ('receita', 'taxa', 'estoque', 'despesa', 'fora')),
  sistema text unique, -- categorias usadas automaticamente pelo app
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.categorias_financeiras (nome, tipo, dre, sistema) values
  ('Serviços (OS)', 'entrada', 'receita', 'os'),
  ('Faturas de lojistas', 'entrada', 'receita', 'fatura'),
  ('Outras receitas', 'entrada', 'receita', null),
  ('Aporte / transferência', 'entrada', 'fora', null),
  ('Taxas de cartão', 'saida', 'taxa', 'taxa'),
  ('Compra de produtos', 'saida', 'estoque', 'compra_produtos'),
  ('Aluguel', 'saida', 'despesa', null),
  ('Água, luz e internet', 'saida', 'despesa', null),
  ('Salários e diárias', 'saida', 'despesa', null),
  ('Impostos', 'saida', 'despesa', null),
  ('Marketing', 'saida', 'despesa', null),
  ('Manutenção e equipamentos', 'saida', 'despesa', null),
  ('Outras despesas', 'saida', 'despesa', null),
  ('Retirada / transferência', 'saida', 'fora', null);

insert into public.contas (nome, tipo) values ('Caixa da loja', 'caixa'), ('Banco', 'banco');

-- ===========================================================================
-- 7. Faturas de lojistas
-- ===========================================================================
create table public.faturas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  periodo_inicio date not null,
  periodo_fim date not null,
  emissao date not null default current_date,
  vencimento date not null,
  total numeric(12, 2) not null default 0 check (total >= 0),
  valor_pago numeric(12, 2) not null default 0 check (valor_pago >= 0),
  -- aberta → parcial → paga ; cancelada. "Vencida" é calculado pela data.
  situacao text not null default 'aberta' check (situacao in ('aberta', 'parcial', 'paga', 'cancelada')),
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (periodo_fim >= periodo_inicio)
);

create index faturas_cliente on public.faturas (cliente_id, emissao desc);

create trigger faturas_atualizado_em
  before update on public.faturas
  for each row execute function public.tocar_atualizado_em();

-- Cópia das OS no momento da fatura (o extrato não muda se a OS for editada depois)
create table public.fatura_itens (
  id uuid primary key default gen_random_uuid(),
  fatura_id uuid not null references public.faturas (id) on delete cascade,
  os_id uuid, -- chave criada mais abaixo
  data date not null,
  placa text,
  veiculo text,
  servicos text not null default '',
  valor numeric(12, 2) not null default 0
);

create index fatura_itens_fatura on public.fatura_itens (fatura_id);

-- ===========================================================================
-- 8. Ordens de serviço
-- ===========================================================================
create table public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique, -- OS #1, #2, ...
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  veiculo_id uuid references public.veiculos (id) on delete set null,
  placa text, -- cópia (a OS continua legível mesmo se o veículo for excluído)
  veiculo_nome text,
  data date not null default current_date,
  -- aberta → em_andamento → pronta → entregue ; ou cancelada
  status text not null default 'aberta' check (status in ('aberta', 'em_andamento', 'pronta', 'entregue', 'cancelada')),
  km integer check (km >= 0),
  observacoes text,
  subtotal numeric(12, 2) not null default 0,
  desconto numeric(12, 2) not null default 0 check (desconto >= 0),
  total numeric(12, 2) not null default 0,
  pago boolean not null default false,
  pago_em date,
  forma_pagamento text check (forma_pagamento in ('pix', 'dinheiro', 'debito', 'credito', 'transferencia')),
  conta_id uuid references public.contas (id) on delete set null,
  taxa_valor numeric(12, 2) not null default 0,
  fatura_id uuid references public.faturas (id) on delete set null,
  custo_produtos numeric(12, 2) not null default 0,
  estoque_baixado boolean not null default false,
  agendamento_id uuid references public.agendamentos (id) on delete set null,
  orcamento_id uuid references public.orcamentos (id) on delete set null,
  servico_historico_id uuid references public.servicos (id) on delete set null,
  pronta_em timestamptz,
  entregue_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index ordens_servico_data on public.ordens_servico (data desc);
create index ordens_servico_cliente on public.ordens_servico (cliente_id, data desc);
create index ordens_servico_status on public.ordens_servico (status);
create index ordens_servico_fatura on public.ordens_servico (fatura_id);

create trigger ordens_servico_atualizado_em
  before update on public.ordens_servico
  for each row execute function public.tocar_atualizado_em();

-- Total sempre = subtotal − desconto (nunca negativo)
create or replace function public.calcular_total_os()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.total := greatest(new.subtotal - new.desconto, 0);
  return new;
end;
$$;

create trigger ordens_servico_total
  before insert or update of subtotal, desconto on public.ordens_servico
  for each row execute function public.calcular_total_os();

create table public.os_itens (
  id uuid primary key default gen_random_uuid(),
  os_id uuid not null references public.ordens_servico (id) on delete cascade,
  catalogo_id uuid references public.catalogo_servicos (id) on delete set null,
  nome text not null,
  preco numeric(12, 2) not null default 0 check (preco >= 0), -- preço praticado nesta OS
  ordem integer not null default 0
);

create index os_itens_os on public.os_itens (os_id, ordem);

-- Subtotal da OS acompanha os itens
create or replace function public.atualizar_subtotal_os()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_os uuid := coalesce(new.os_id, old.os_id);
begin
  update public.ordens_servico
     set subtotal = coalesce((select sum(preco) from public.os_itens where os_id = v_os), 0)
   where id = v_os;
  if tg_op = 'UPDATE' and old.os_id <> new.os_id then
    update public.ordens_servico
       set subtotal = coalesce((select sum(preco) from public.os_itens where os_id = old.os_id), 0)
     where id = old.os_id;
  end if;
  return null;
end;
$$;

create trigger os_itens_subtotal
  after insert or update or delete on public.os_itens
  for each row execute function public.atualizar_subtotal_os();

alter table public.estoque_movimentos
  add constraint estoque_movimentos_os_fk foreign key (os_id) references public.ordens_servico (id) on delete set null;
alter table public.fatura_itens
  add constraint fatura_itens_os_fk foreign key (os_id) references public.ordens_servico (id) on delete set null;

-- Lançamentos (entradas e saídas de dinheiro)
create table public.lancamentos (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date, -- competência (mês em que conta no resultado)
  vencimento date, -- para contas a pagar / receber
  tipo text not null check (tipo in ('entrada', 'saida')),
  descricao text not null,
  valor numeric(12, 2) not null check (valor > 0),
  categoria_id uuid references public.categorias_financeiras (id) on delete set null,
  conta_id uuid references public.contas (id) on delete set null,
  pago boolean not null default true,
  pago_em date,
  os_id uuid references public.ordens_servico (id) on delete set null,
  fatura_id uuid references public.faturas (id) on delete set null,
  criado_em timestamptz not null default now()
);

create index lancamentos_data on public.lancamentos (data);
create index lancamentos_vencimento on public.lancamentos (vencimento) where not pago;
create index lancamentos_conta on public.lancamentos (conta_id);

create table public.fatura_pagamentos (
  id uuid primary key default gen_random_uuid(),
  fatura_id uuid not null references public.faturas (id) on delete cascade,
  data date not null default current_date,
  valor numeric(12, 2) not null check (valor > 0),
  forma text check (forma in ('pix', 'dinheiro', 'debito', 'credito', 'transferencia')),
  conta_id uuid references public.contas (id) on delete set null,
  lancamento_id uuid references public.lancamentos (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- Situação da fatura acompanha os pagamentos
create or replace function public.atualizar_situacao_fatura()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fatura uuid := coalesce(new.fatura_id, old.fatura_id);
begin
  update public.faturas f
     set valor_pago = coalesce((select sum(valor) from public.fatura_pagamentos where fatura_id = v_fatura), 0)
   where f.id = v_fatura;
  update public.faturas
     set situacao = case
       when situacao = 'cancelada' then 'cancelada'
       when valor_pago >= total then 'paga'
       when valor_pago > 0 then 'parcial'
       else 'aberta' end
   where id = v_fatura;
  return null;
end;
$$;

create trigger fatura_pagamentos_situacao
  after insert or update or delete on public.fatura_pagamentos
  for each row execute function public.atualizar_situacao_fatura();

-- Ligação com o agendamento/orçamento: uma OS por agendamento
create unique index ordens_servico_agendamento on public.ordens_servico (agendamento_id)
  where agendamento_id is not null and status <> 'cancelada';

-- Resumos calculados pelo banco (respeitam as regras de acesso de quem consulta)
create view public.gestao_saldos_contas with (security_invoker = true) as
select c.id as conta_id,
       c.saldo_inicial
       + coalesce(sum(case when l.tipo = 'entrada' then l.valor else -l.valor end) filter (where l.pago), 0) as saldo
  from public.contas c
  left join public.lancamentos l on l.conta_id = c.id
 group by c.id;

create view public.gestao_resumo_clientes with (security_invoker = true) as
select cliente_id,
       coalesce(sum(total) filter (where status in ('pronta', 'entregue')), 0) as total_gasto,
       max(data) filter (where status <> 'cancelada') as ultima_visita,
       count(*) filter (where status <> 'cancelada') as qtd_os
  from public.ordens_servico
 group by cliente_id;

-- ===========================================================================
-- 9. Operações que precisam acontecer "tudo ou nada"
-- ===========================================================================

-- Baixa do estoque pelo consumo dos serviços da OS (ao marcar como pronta).
-- Grava o custo dos produtos na OS. Não faz nada se a baixa já foi feita.
create or replace function public.gestao_baixar_estoque_os(p_os uuid)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_numero bigint;
  v_custo numeric := 0;
  r record;
  v_saldo numeric;
begin
  if not public.is_admin() then
    raise exception 'Somente a empresa pode fazer isso.';
  end if;

  select numero into v_numero from public.ordens_servico
   where id = p_os and not estoque_baixado for update;
  if v_numero is null then
    return (select custo_produtos from public.ordens_servico where id = p_os);
  end if;

  for r in
    select c.produto_id, sum(c.quantidade) as qtd
      from public.os_itens i
      join public.catalogo_consumo c on c.servico_id = i.catalogo_id
     where i.os_id = p_os
     group by c.produto_id
  loop
    update public.produtos set saldo = saldo - r.qtd
     where id = r.produto_id
    returning saldo into v_saldo;

    insert into public.estoque_movimentos (produto_id, tipo, quantidade, custo_unitario, saldo_apos, origem, os_id)
    select r.produto_id, 'baixa', -r.qtd, p.custo_medio, v_saldo, 'OS #' || v_numero, p_os
      from public.produtos p where p.id = r.produto_id;

    v_custo := v_custo + r.qtd * (select custo_medio from public.produtos where id = r.produto_id);
  end loop;

  update public.ordens_servico
     set estoque_baixado = true, custo_produtos = round(v_custo, 2)
   where id = p_os;
  return round(v_custo, 2);
end;
$$;

-- Devolve ao estoque o que foi baixado (ao cancelar ou reabrir a OS)
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

  for r in
    select produto_id, -sum(quantidade) as qtd, max(custo_unitario) as custo
      from public.estoque_movimentos
     where os_id = p_os and tipo = 'baixa'
     group by produto_id
  loop
    update public.produtos set saldo = saldo + r.qtd where id = r.produto_id returning saldo into v_saldo;
    insert into public.estoque_movimentos (produto_id, tipo, quantidade, custo_unitario, saldo_apos, origem, os_id)
    values (r.produto_id, 'ajuste', r.qtd, r.custo, v_saldo, 'Estorno OS #' || v_numero, p_os);
  end loop;

  update public.ordens_servico set estoque_baixado = false, custo_produtos = 0 where id = p_os;
end;
$$;

-- Reposição: soma ao saldo e recalcula o custo médio. Opcionalmente lança a compra no financeiro.
create or replace function public.gestao_repor_produto(
  p_produto uuid,
  p_quantidade numeric,
  p_custo_total numeric,
  p_lancar boolean default false,
  p_conta uuid default null,
  p_pago boolean default true,
  p_vencimento date default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  p record;
  v_custo_unit numeric;
  v_novo_custo numeric;
begin
  if not public.is_admin() then
    raise exception 'Somente a empresa pode fazer isso.';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade inválida.';
  end if;
  if p_custo_total is null or p_custo_total < 0 then
    raise exception 'Valor inválido.';
  end if;

  select * into p from public.produtos where id = p_produto for update;
  if p is null then
    raise exception 'Produto não encontrado.';
  end if;

  v_custo_unit := p_custo_total / p_quantidade;
  if p.saldo > 0 then
    v_novo_custo := (p.saldo * p.custo_medio + p_custo_total) / (p.saldo + p_quantidade);
  else
    v_novo_custo := v_custo_unit;
  end if;

  update public.produtos
     set saldo = saldo + p_quantidade, custo_medio = round(v_novo_custo, 4)
   where id = p_produto;

  insert into public.estoque_movimentos (produto_id, tipo, quantidade, custo_unitario, saldo_apos, origem)
  values (p_produto, 'reposicao', p_quantidade, round(v_custo_unit, 4), p.saldo + p_quantidade, 'Compra');

  if p_lancar and p_custo_total > 0 then
    insert into public.lancamentos (data, vencimento, tipo, descricao, valor, categoria_id, conta_id, pago, pago_em)
    values (
      current_date,
      case when p_pago then null else coalesce(p_vencimento, current_date) end,
      'saida',
      'Compra: ' || p.nome,
      round(p_custo_total, 2),
      (select id from public.categorias_financeiras where sistema = 'compra_produtos'),
      p_conta,
      p_pago,
      case when p_pago then current_date else null end
    );
  end if;
end;
$$;

-- Ajuste de saldo (contagem do estoque)
create or replace function public.gestao_ajustar_produto(p_produto uuid, p_novo_saldo numeric, p_observacao text default null)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_atual numeric;
begin
  if not public.is_admin() then
    raise exception 'Somente a empresa pode fazer isso.';
  end if;
  select saldo into v_atual from public.produtos where id = p_produto for update;
  if v_atual is null then
    raise exception 'Produto não encontrado.';
  end if;
  if p_novo_saldo = v_atual then
    return;
  end if;
  update public.produtos set saldo = p_novo_saldo where id = p_produto;
  insert into public.estoque_movimentos (produto_id, tipo, quantidade, custo_unitario, saldo_apos, origem, observacao)
  select p_produto, 'ajuste', p_novo_saldo - v_atual, custo_medio, p_novo_saldo, 'Ajuste', p_observacao
    from public.produtos where id = p_produto;
end;
$$;

-- Recebimento de uma OS avulsa: entrada no caixa e, no cartão, a taxa da maquininha como saída.
create or replace function public.gestao_receber_os(
  p_os uuid,
  p_forma text,
  p_conta uuid,
  p_data date default current_date
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  o record;
  v_taxa_pct numeric := 0;
  v_taxa numeric := 0;
begin
  if not public.is_admin() then
    raise exception 'Somente a empresa pode fazer isso.';
  end if;
  if p_forma not in ('pix', 'dinheiro', 'debito', 'credito', 'transferencia') then
    raise exception 'Forma de pagamento inválida.';
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

  if p_forma = 'debito' then
    select taxa_debito into v_taxa_pct from public.gestao_config limit 1;
  elsif p_forma = 'credito' then
    select taxa_credito into v_taxa_pct from public.gestao_config limit 1;
  end if;
  v_taxa := round(o.total * coalesce(v_taxa_pct, 0) / 100, 2);

  if o.total > 0 then
    insert into public.lancamentos (data, tipo, descricao, valor, categoria_id, conta_id, pago, pago_em, os_id)
    values (p_data, 'entrada', 'OS #' || o.numero || coalesce(' · ' || o.placa, ''), o.total,
            (select id from public.categorias_financeiras where sistema = 'os'), p_conta, true, p_data, p_os);
  end if;
  if v_taxa > 0 then
    insert into public.lancamentos (data, tipo, descricao, valor, categoria_id, conta_id, pago, pago_em, os_id)
    values (p_data, 'saida', 'Taxa ' || case when p_forma = 'debito' then 'débito' else 'crédito' end || ' · OS #' || o.numero,
            v_taxa, (select id from public.categorias_financeiras where sistema = 'taxa'), p_conta, true, p_data, p_os);
  end if;

  update public.ordens_servico
     set pago = true, pago_em = p_data, forma_pagamento = p_forma, conta_id = p_conta, taxa_valor = v_taxa
   where id = p_os;
end;
$$;

-- Gera a fatura de um lojista com as OS escolhidas (prontas/entregues e ainda sem fatura)
create or replace function public.gestao_gerar_fatura(p_cliente uuid, p_os uuid[], p_vencimento date, p_observacoes text default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_fatura uuid;
  v_total numeric;
  v_ini date;
  v_fim date;
  v_qtd integer;
begin
  if not public.is_admin() then
    raise exception 'Somente a empresa pode fazer isso.';
  end if;

  perform 1 from public.ordens_servico where id = any (p_os) for update;

  select count(*), sum(total), min(data), max(data) into v_qtd, v_total, v_ini, v_fim
    from public.ordens_servico
   where id = any (p_os) and cliente_id = p_cliente and fatura_id is null
     and status in ('pronta', 'entregue') and not pago;

  if v_qtd = 0 or v_qtd <> coalesce(array_length(p_os, 1), 0) then
    raise exception 'Algumas OS não podem entrar nesta fatura (já faturadas, pagas ou não prontas). Atualize a página.';
  end if;

  insert into public.faturas (cliente_id, periodo_inicio, periodo_fim, vencimento, total, observacoes)
  values (p_cliente, v_ini, v_fim, p_vencimento, v_total, p_observacoes)
  returning id into v_fatura;

  insert into public.fatura_itens (fatura_id, os_id, data, placa, veiculo, servicos, valor)
  select v_fatura, os.id, os.data, os.placa, os.veiculo_nome,
         coalesce((select string_agg(i.nome, ', ' order by i.ordem) from public.os_itens i where i.os_id = os.id), ''),
         os.total
    from public.ordens_servico os
   where os.id = any (p_os)
   order by os.data, os.numero;

  update public.ordens_servico set fatura_id = v_fatura where id = any (p_os);
  return v_fatura;
end;
$$;

-- Pagamento (parcial ou total) de uma fatura: gera a entrada no financeiro
create or replace function public.gestao_pagar_fatura(p_fatura uuid, p_valor numeric, p_forma text, p_conta uuid, p_data date default current_date)
returns void
language plpgsql
set search_path = ''
as $$
declare
  f record;
  v_lanc uuid;
begin
  if not public.is_admin() then
    raise exception 'Somente a empresa pode fazer isso.';
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

  insert into public.lancamentos (data, tipo, descricao, valor, categoria_id, conta_id, pago, pago_em, fatura_id)
  values (p_data, 'entrada', 'Fatura #' || f.numero, round(p_valor, 2),
          (select id from public.categorias_financeiras where sistema = 'fatura'), p_conta, true, p_data, p_fatura)
  returning id into v_lanc;

  insert into public.fatura_pagamentos (fatura_id, data, valor, forma, conta_id, lancamento_id)
  values (p_fatura, p_data, round(p_valor, 2), p_forma, p_conta, v_lanc);

  -- Fatura quitada: as OS dela ficam como pagas
  if (select situacao from public.faturas where id = p_fatura) = 'paga' then
    update public.ordens_servico
       set pago = true, pago_em = p_data, forma_pagamento = p_forma, conta_id = p_conta
     where fatura_id = p_fatura;
  end if;
end;
$$;

-- ===========================================================================
-- 10. Segurança: tudo da gestão é só da empresa (administrador)
-- ===========================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'produtos', 'estoque_movimentos', 'catalogo_servicos', 'catalogo_consumo', 'contas',
    'categorias_financeiras', 'faturas', 'fatura_itens', 'fatura_pagamentos', 'ordens_servico',
    'os_itens', 'lancamentos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Somente a empresa" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
      t
    );
  end loop;
end;
$$;

revoke execute on function public.gestao_baixar_estoque_os(uuid) from public, anon;
revoke execute on function public.gestao_estornar_estoque_os(uuid) from public, anon;
revoke execute on function public.gestao_repor_produto(uuid, numeric, numeric, boolean, uuid, boolean, date) from public, anon;
revoke execute on function public.gestao_ajustar_produto(uuid, numeric, text) from public, anon;
revoke execute on function public.gestao_receber_os(uuid, text, uuid, date) from public, anon;
revoke execute on function public.gestao_gerar_fatura(uuid, uuid[], date, text) from public, anon;
revoke execute on function public.gestao_pagar_fatura(uuid, numeric, text, uuid, date) from public, anon;
grant execute on function public.gestao_baixar_estoque_os(uuid) to authenticated;
grant execute on function public.gestao_estornar_estoque_os(uuid) to authenticated;
grant execute on function public.gestao_repor_produto(uuid, numeric, numeric, boolean, uuid, boolean, date) to authenticated;
grant execute on function public.gestao_ajustar_produto(uuid, numeric, text) to authenticated;
grant execute on function public.gestao_receber_os(uuid, text, uuid, date) to authenticated;
grant execute on function public.gestao_gerar_fatura(uuid, uuid[], date, text) to authenticated;
grant execute on function public.gestao_pagar_fatura(uuid, numeric, text, uuid, date) to authenticated;

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

