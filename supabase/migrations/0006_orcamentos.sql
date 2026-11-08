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
