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
