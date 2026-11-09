-- Sempre Zero — Estado (UF) de registro do veículo, para os calendários de IPVA e licenciamento
-- Execute no Supabase depois do 0008: SQL Editor > New query > cole > Run

alter table public.veiculos
  add column if not exists uf char(2) not null default 'SP';
