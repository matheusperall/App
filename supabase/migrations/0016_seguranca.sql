-- Sempre Zero — Ajustes de segurança (revisão de proteção de dados)
-- Execute no Supabase depois do 0015: SQL Editor > New query > cole > Run
--
-- 1) Serviço registrado pelo cliente não pode ser "promovido" a serviço feito pela loja.
-- 2) Documento só pode ficar em veículo que a pessoa acessa (também ao editar).
-- 3) No orçamento, o cliente só aceita, recusa ou cancela: não altera categoria, vínculo nem autoria.

-- 1) Serviços: na edição feita pelo cliente, autoria e prestador ficam como estavam
create or replace function public.proteger_servico_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  new.pela_empresa := old.pela_empresa;
  new.registrado_por := old.registrado_por;
  new.prestador := 'externo';
  return new;
end;
$$;

drop trigger if exists servicos_proteger_cliente on public.servicos;
create trigger servicos_proteger_cliente
  before update on public.servicos
  for each row execute function public.proteger_servico_cliente();

-- 2) Documentos: ao editar, o veículo também precisa ser acessível
drop policy if exists "Editar documentos" on public.documentos;
create policy "Editar documentos" on public.documentos for update to authenticated
  using (dono_id = (select auth.uid()) or (select public.is_admin()))
  with check (
    (dono_id = (select auth.uid()) or (select public.is_admin()))
    and (veiculo_id is null or (select public.pode_acessar_veiculo(veiculo_id)))
  );

-- 3) Orçamentos: regras do lado do cliente (mais campos protegidos)
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
     or new.pedido is distinct from old.pedido or new.fotos <> old.fotos
     or new.categoria <> old.categoria or new.apontamento_id is distinct from old.apontamento_id
     or new.solicitado_por is distinct from old.solicitado_por or new.respondido_em is distinct from old.respondido_em then
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
