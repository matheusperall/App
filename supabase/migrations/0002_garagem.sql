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
