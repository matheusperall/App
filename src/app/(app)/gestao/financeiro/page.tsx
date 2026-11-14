import type { Metadata } from "next";
import Link from "next/link";
import { Vazio } from "@/components/gestao";
import { Cabecalho, CelulaStatus, Etiqueta, GrupoMes, ResumoPeriodo, type Cor } from "@/components/gestao/Cabecalho";
import { Icone } from "@/components/gestao/Icones";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, formatarValor, hojeISO } from "@/lib/garagem";
import { arred, combina, limitesMes, mesAtual, mesValido } from "@/lib/gestao";
import { montarMovimentos, type Mov } from "./movimentos";
import { comprasNosCartoes, contasAPagar, contasAReceberAvulsas, lancamentosPeriodo, listarCartoes, listarCategorias, listarContas } from "@/lib/gestao-dados";
import { abasFinanceiro } from "./abas";
import { AcoesLancamento } from "./AcoesLancamento";
import { FiltrosMovimentacoes } from "./FiltrosMovimentacoes";
import { lerLista } from "./filtros";

export const metadata: Metadata = { title: "Financeiro" };

const COLUNAS = "grid-cols-[7rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_8rem_8rem_2.75rem]";
const ehDia = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function situacao(m: Mov, hoje: string): { texto: string; cor: Cor } {
  if (m.pago) return { texto: m.tipo === "saida" ? "Pago" : "Recebido", cor: "verde" };
  if (m.data < hoje) return { texto: "Vencido", cor: "vermelho" };
  return { texto: m.tipo === "saida" ? "A pagar" : "A receber", cor: "amarelo" };
}

export default async function FinanceiroPage({ searchParams }: PageProps<"/gestao/financeiro">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const hoje = hojeISO();
  // Período: de/até; ou o mês (?mes=) ; ou o mês atual
  const mesBase = mesValido(sp.mes) ? sp.mes : mesAtual();
  const doMes = limitesMes(mesBase);
  const de = ehDia(sp.de) ? sp.de : doMes.inicio;
  const ate = ehDia(sp.ate) && sp.ate >= de ? sp.ate : ehDia(sp.de) ? de : doMes.fim;
  const busca = typeof sp.q === "string" ? sp.q : "";
  const tipo = lerLista(sp.tipo, "tipo");
  const filtroSituacao = lerLista(sp.situacao, "situacao");
  const recorrencia = lerLista(sp.recorrencia, "recorrencia");

  const [contas, categorias, doPeriodoBruto, aPagar, aReceber, cartoes, compras] = await Promise.all([
    listarContas(),
    listarCategorias(),
    lancamentosPeriodo(de, ate),
    contasAPagar(),
    contasAReceberAvulsas(),
    listarCartoes(),
    comprasNosCartoes(),
  ]);
  const idsContas = new Set(contas.map((c) => c.id));
  const contasFiltro = typeof sp.contas === "string" ? sp.contas.split(",").filter((id) => idsContas.has(id)) : [];
  const ativas = contas.filter((c) => c.ativa);
  const movs = montarMovimentos({ de, ate, lancamentos: doPeriodoBruto, pendentes: [...aPagar, ...aReceber], compras, cartoes, categorias, contas });

  // 3) Filtros
  let lista = movs;
  if (contasFiltro.length) lista = lista.filter((m) => m.contaId && contasFiltro.includes(m.contaId));
  // Dentro de cada grupo vale "qualquer um marcado"; entre grupos, todos precisam valer
  const ehTipo: Record<string, (m: Mov) => boolean> = {
    entradas: (m) => m.tipo === "entrada" && !m.transferencia,
    saidas: (m) => m.tipo === "saida" && !m.transferencia,
    transferencias: (m) => m.transferencia,
  };
  const ehSituacao: Record<string, (m: Mov) => boolean> = {
    recebidas: (m) => m.tipo === "entrada" && m.pago,
    a_receber: (m) => m.tipo === "entrada" && !m.pago && m.data >= hoje,
    receber_vencidas: (m) => m.tipo === "entrada" && !m.pago && m.data < hoje,
    pagas: (m) => m.tipo === "saida" && m.pago,
    a_pagar: (m) => m.tipo === "saida" && !m.pago && m.data >= hoje,
    vencidas: (m) => m.tipo === "saida" && !m.pago && m.data < hoje,
  };
  const ehRecorrencia: Record<string, (m: Mov) => boolean> = {
    fixas: (m) => Boolean(m.lancamento?.recorrente),
    variaveis: (m) => !m.lancamento?.recorrente,
  };
  if (tipo.length) lista = lista.filter((m) => tipo.some((k) => ehTipo[k](m)));
  if (filtroSituacao.length) lista = lista.filter((m) => filtroSituacao.some((k) => ehSituacao[k](m)));
  if (recorrencia.length) lista = lista.filter((m) => recorrencia.some((k) => ehRecorrencia[k](m)));
  if (busca.trim()) lista = lista.filter((m) => combina(`${m.descricao} ${m.categoria ?? ""} ${m.detalhe ?? ""}`, busca));
  lista.sort((a, b) => b.data.localeCompare(a.data));
  const atrasados = lista.filter((m) => m.data < de);
  const doPeriodo = lista.filter((m) => m.data >= de);

  // 4) Resumo do período (dinheiro que entrou e saiu; transferências não contam)
  const efetivos = doPeriodo.filter((m) => !m.transferencia);
  const soma = (l: Mov[]) => arred(l.reduce((t, m) => t + m.valor, 0));
  const recebidos = soma(efetivos.filter((m) => m.tipo === "entrada" && m.pago));
  const pagos = soma(efetivos.filter((m) => m.tipo === "saida" && m.pago));
  const aReceberPeriodo = soma(lista.filter((m) => m.tipo === "entrada" && !m.pago && !m.transferencia));
  const aPagarPeriodo = soma(lista.filter((m) => m.tipo === "saida" && !m.pago && !m.transferencia));
  const saldo = arred((contasFiltro.length ? ativas.filter((c) => contasFiltro.includes(c.id)) : ativas).reduce((t, c) => t + c.saldo, 0));
  const filtrando = Boolean(busca || tipo.length || filtroSituacao.length || recorrencia.length || contasFiltro.length);

  return (
    <div className="space-y-4">
      <Cabecalho
        icone="financeiro"
        titulo="Financeiro"
        abas={abasFinanceiro("movimentacoes")}
        acao={{ href: "/gestao/financeiro/novo", rotulo: "Adicionar" }}
        extra={
          <Link href="/gestao/financeiro/categorias" className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-suave hover:bg-fundo hover:text-texto sm:px-3" title="Editar categorias" aria-label="Editar categorias">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>
            <span className="hidden sm:inline">Categorias</span>
          </Link>
        }
      />

      <FiltrosMovimentacoes
        contas={contas.map((c) => ({ id: c.id, nome: c.nome }))}
        valores={{ de, ate, contas: contasFiltro, tipo, situacao: filtroSituacao, recorrencia, q: busca }}
        hoje={hoje}
      />

      <ResumoPeriodo
        titulo={`Resumo de ${formatarData(de)} a ${formatarData(ate)}`}
        itens={[
          { rotulo: "Saldo atual", valor: saldo, cor: saldo < 0 ? "vermelho" : "verde" },
          { rotulo: "Recebidos", valor: recebidos, cor: "verde", sinal: true },
          { rotulo: "Pagos", valor: -pagos, cor: "vermelho" },
          { rotulo: "Geração de caixa", valor: arred(recebidos - pagos), cor: recebidos - pagos < 0 ? "vermelho" : "verde" },
          { rotulo: "A receber", valor: aReceberPeriodo, cor: "amarelo" },
          { rotulo: "A pagar", valor: -aPagarPeriodo, cor: "vermelho" },
        ]}
      />

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-borda bg-white">
          <Vazio>
            Nenhum lançamento {filtrando ? "com esses filtros" : "neste período"}. <Link href="/gestao/financeiro/novo" className="font-semibold text-marca-escura">Adicionar</Link>
          </Vazio>
        </div>
      ) : (
        <div className="space-y-2">
          <div className={`hidden ${COLUNAS} items-center rounded-xl border border-borda bg-white text-sm font-semibold lg:grid`}>
            <span className="px-4 py-3">Data</span>
            <span className="px-3 py-3">Transação</span>
            <span className="px-3 py-3">Conta</span>
            <span className="px-3 py-3">Categoria</span>
            <span className="px-3 py-3 text-right">Valor</span>
            <span className="px-4 py-3">Status</span>
            <span />
          </div>
          {atrasados.length > 0 && <GrupoMes titulo="Atrasados de antes do período" />}
          {atrasados.map((m) => <Linha key={m.chave} m={m} hoje={hoje} contas={ativas} />)}
          {atrasados.length > 0 && doPeriodo.length > 0 && <GrupoMes titulo="No período" />}
          {doPeriodo.map((m) => <Linha key={m.chave} m={m} hoje={hoje} contas={ativas} />)}
        </div>
      )}
    </div>
  );
}

function Linha({ m, hoje, contas }: { m: Mov; hoje: string; contas: { id: string; nome: string }[] }) {
  const s = situacao(m, hoje);
  const saida = m.tipo === "saida";
  const valor = (
    <span className={`font-semibold tabular-nums ${m.transferencia ? "text-suave" : saida ? "text-perigo" : "text-sucesso"}`}>
      {saida ? "− " : "+ "}{formatarValor(m.valor)}
    </span>
  );
  const icone = m.transferencia ? "financeiro" : m.href?.includes("/cartoes/") ? "cartao" : saida ? "saida" : "entrada";
  const transacao = (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.transferencia ? "bg-fundo text-suave" : saida ? "bg-perigo-claro text-perigo" : "bg-sucesso-claro text-sucesso"}`}>
        <Icone nome={icone} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        {m.href ? (
          <Link href={m.href} className="block truncate font-medium hover:underline">{m.descricao}</Link>
        ) : (
          <span className="block truncate font-medium">{m.descricao}</span>
        )}
        {(m.detalhe || m.transferencia) && <span className="block text-xs text-suave">{m.transferencia ? "Transferência entre contas" : m.detalhe}</span>}
      </span>
    </span>
  );
  const acoes = m.lancamento ? <AcoesLancamento l={m.lancamento} contas={contas} hoje={hoje} /> : <span className="w-9" />;
  return (
    <div className="rounded-xl border border-borda bg-white text-sm">
      {/* Computador */}
      <div className={`hidden ${COLUNAS} items-stretch lg:grid`}>
        <span className="px-4 py-3 tabular-nums">{formatarData(m.data)}</span>
        <span className="px-3 py-2">{transacao}</span>
        <span className="truncate px-3 py-3 text-suave">{m.conta ?? "—"}</span>
        <span className="px-3 py-3">{m.categoria ? <Etiqueta texto={m.categoria} /> : <span className="text-suave">—</span>}</span>
        <span className="px-3 py-3 text-right">{valor}</span>
        <CelulaStatus texto={s.texto} cor={s.cor} />
        <span className="flex items-center">{acoes}</span>
      </div>
      {/* Celular */}
      <div className="flex items-start gap-2 px-3 py-3 lg:hidden">
        <div className="min-w-0 flex-1 space-y-1">
          {transacao}
          <p className="pl-[2.6rem] text-xs text-suave">
            {formatarData(m.data)} · {m.conta ?? "—"}{m.categoria && ` · ${m.categoria}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {valor}
          <span className={`text-xs font-semibold ${s.cor === "verde" ? "text-sucesso" : s.cor === "vermelho" ? "text-perigo" : "text-[#b07800]"}`}>{s.texto}</span>
        </div>
        {acoes}
      </div>
    </div>
  );
}
