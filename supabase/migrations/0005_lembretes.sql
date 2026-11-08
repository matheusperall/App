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
