-- Sempre Zero — Anexos de documentos (PDF ou foto): CNH, CRLV-e, apólice do seguro, IPVA e outros
-- Execute no Supabase depois do 0013: SQL Editor > New query > cole > Run

-- Pasta privada para os arquivos (até 10 MB cada; PDF ou foto)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Caminho: <id do dono ou "c-<ficha>">/<...>/<arquivo>. Cada um mexe só na sua pasta; a empresa, em todas.
create policy "Ver documentos anexados" on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or (storage.foldername(name))[1] = (select public.minha_pasta_ficha())
         or (select public.is_admin()))
  );
create policy "Enviar documentos anexados" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
create policy "Excluir documentos anexados" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

-- Lista dos arquivos. Do veículo (veiculo_id) ou da pessoa (dono_id, ex.: CNH).
create table if not exists public.documentos_arquivos (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid references public.perfis (id) on delete cascade,
  veiculo_id uuid references public.veiculos (id) on delete cascade,
  tipo text not null check (tipo in ('cnh', 'crlv', 'seguro', 'ipva', 'nota_fiscal', 'outro')),
  nome text not null,
  caminho text not null unique, -- caminho no Storage (bucket "documentos")
  tamanho integer,
  tipo_mime text,
  enviado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  check (dono_id is not null or veiculo_id is not null)
);

create index if not exists documentos_arquivos_veiculo on public.documentos_arquivos (veiculo_id, criado_em desc);
create index if not exists documentos_arquivos_dono on public.documentos_arquivos (dono_id, criado_em desc);

alter table public.documentos_arquivos enable row level security;

create policy "Ver anexos" on public.documentos_arquivos for select to authenticated
  using (
    (select public.is_admin())
    or dono_id = (select auth.uid())
    or (veiculo_id is not null and (select public.pode_acessar_veiculo(veiculo_id)))
  );
create policy "Anexar" on public.documentos_arquivos for insert to authenticated
  with check (
    (select public.is_admin())
    or (dono_id = (select auth.uid()) and veiculo_id is null)
    or (veiculo_id is not null and (select public.pode_acessar_veiculo(veiculo_id)))
  );
create policy "Excluir anexos" on public.documentos_arquivos for delete to authenticated
  using (
    (select public.is_admin())
    or dono_id = (select auth.uid())
    or (veiculo_id is not null and (select public.pode_acessar_veiculo(veiculo_id)))
  );
