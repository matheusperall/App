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
