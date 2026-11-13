-- Sempre Zero — LIMPEZA DOS DADOS DE TESTE (rodar UMA vez, antes de importar os dados da CERA)
-- SQL Editor > New query > cole TUDO > Run.  ⚠️ APAGA DE VERDADE. Não tem como desfazer.
-- Faça antes um backup (Database > Backups, ou Table Editor > Export to CSV das tabelas importantes).
--
-- FICAM:
--   * as contas de administrador (login e perfil);
--   * contas (Caixa, Banco, Maquininha…), formas e taxas, cartões de crédito e categorias do financeiro;
--     o saldo de cada conta volta a ser o saldo inicial (porque os lançamentos são apagados);
--   * catálogo de serviços (preços e consumo de produtos) e os produtos do estoque, com saldo e custo zerados;
--   * ajustes da gestão (vagas do pátio e modelos de mensagens de WhatsApp).
-- SÃO APAGADOS:
--   * clientes (fichas), veículos, histórico de serviços, lembretes de manutenção, leituras de km, documentos e CNH;
--   * ordens de serviço, pagamentos, faturas, lançamentos do financeiro e movimentos de estoque;
--   * orçamentos, agendamentos, apontamentos, avisos, comunicados e inscrições de notificação;
--   * todos os logins que NÃO são de administrador (clientes de teste do app).
-- A numeração (OS #, Orçamento #, Fatura #) volta a começar do 1.
-- Fotos e PDFs guardados no Storage não são apagados por aqui: veja o passo no fim deste arquivo.

begin;

-- Segurança: só continua se existir pelo menos um administrador
do $$
begin
  if not exists (select 1 from public.perfis where papel = 'admin') then
    raise exception 'Nenhum administrador encontrado. Nada foi apagado.';
  end if;
end $$;

truncate table
  public.os_pagamentos,
  public.fatura_pagamentos,
  public.fatura_itens,
  public.estoque_movimentos,
  public.os_itens,
  public.lancamentos,
  public.ordens_servico,
  public.faturas,
  public.agendamentos,
  public.orcamentos,
  public.apontamentos,
  public.documentos_arquivos,
  public.documentos,
  public.leituras_km,
  public.manutencoes,
  public.servicos,
  public.veiculos,
  public.clientes,
  public.notificacoes,
  public.comunicados,
  public.lembretes_enviados,
  public.push_inscricoes
restart identity;

-- Produtos ficam cadastrados, mas sem saldo (o estoque real entra depois)
update public.produtos set saldo = 0, custo_medio = 0;

-- Logins de teste (todos que não são administrador). O perfil some junto.
delete from auth.users where id not in (select id from public.perfis where papel = 'admin');

-- Fichas dos administradores (o app recria sozinho quando precisar)
insert into public.clientes (perfil_id, nome, telefone, email)
select p.id, p.nome, p.telefone, p.email from public.perfis p
on conflict (perfil_id) do nothing;

commit;

-- Conferência: tudo deve mostrar 0, menos administradores, contas, cartões, categorias, serviços e produtos.
-- "clientes (fichas)" mostra 1 por administrador (a ficha da sua própria conta).
select 'administradores' as o_que, count(*) from public.perfis
union all select 'contas', count(*) from public.contas
union all select 'cartões', count(*) from public.cartoes
union all select 'categorias', count(*) from public.categorias_financeiras
union all select 'serviços do catálogo', count(*) from public.catalogo_servicos
union all select 'produtos', count(*) from public.produtos
union all select 'clientes (fichas)', count(*) from public.clientes
union all select 'veículos', count(*) from public.veiculos
union all select 'ordens de serviço', count(*) from public.ordens_servico
union all select 'orçamentos', count(*) from public.orcamentos
union all select 'agendamentos', count(*) from public.agendamentos
union all select 'lançamentos', count(*) from public.lancamentos
union all select 'faturas', count(*) from public.faturas;

-- Depois (opcional): para apagar as fotos e PDFs de teste, vá em Storage, abra os buckets "fotos" e "documentos",
-- selecione as pastas e toque em Delete.
