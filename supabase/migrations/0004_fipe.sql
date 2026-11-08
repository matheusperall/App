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
