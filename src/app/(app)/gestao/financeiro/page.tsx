import type { Metadata } from "next";
import Link from "next/link";
import { NavMes, Vazio } from "@/components/gestao";
import { Cabecalho, CelulaStatus, Etiqueta, GrupoMes, ResumoPeriodo, type Cor } from "@/components/gestao/Cabecalho";
import { Icone } from "@/components/gestao/Icones";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, formatarValor, hojeISO } from "@/lib/garagem";
import { arred, combina, limitesMes, mesAtual, mesValido, rotuloSerie, type Lancamento } from "@/lib/gestao";
import { contasAPagar, contasAReceberAvulsas, lancamentosDoMes, listarCategorias, listarContas } from "@/lib/gestao-dados";
import { abasFinanceiro } from "./abas";
import { AcoesLancamento } from "./AcoesLancamento";

export const metadata: Metadata = { title: "Financeiro" };

const COLUNAS = "grid-cols-[7rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_8rem_8rem_2.75rem]";

/** Data que aparece na lista: quando foi pago, ou o vencimento (ou a competência). */
const dataDe = (l: Lancamento) => (l.pago ? (l.pago_em ?? l.data) : (l.vencimento ?? l.data));

function situacao(l: Lancamento, hoje: string): { texto: string; cor: Cor } {
  if (l.pago) return { texto: l.tipo === "saida" ? "Pago" : "Recebido", cor: "verde" };
  if (dataDe(l) < hoje) return { texto: "Vencido", cor: "vermelho" };
  return { texto: l.tipo === "saida" ? "A pagar" : "A receber", cor: "amarelo" };
}

export default async function FinanceiroPage({ searchParams }: PageProps<"/gestao/financeiro">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const mes = mesValido(sp.mes) ? sp.mes : mesAtual();
  const busca = typeof sp.q === "string" ? sp.q : "";
  const contaFiltro = typeof sp.conta === "string" ? sp.conta : "";
  const hoje = hojeISO();
  const [contas, categorias, doMes, aPagar, aReceber] = await Promise.all([listarContas(), listarCategorias(), lancamentosDoMes(mes), contasAPagar(), contasAReceberAvulsas()]);
  const cat = new Map(categorias.map((c) => [c.id, c]));
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
  const ativas = contas.filter((c) => c.ativa);
  const { inicio } = limitesMes(mes);

  // Lançamentos do mês + atrasados de meses anteriores (ainda não pagos)
  const mapa = new Map<string, Lancamento>();
  for (const l of [...doMes.filter((l) => dataDe(l).startsWith(mes)), ...[...aPagar, ...aReceber].filter((l) => dataDe(l) < inicio)]) mapa.set(l.id, l);
  let lista = [...mapa.values()];
  if (contaFiltro) lista = lista.filter((l) => l.conta_id === contaFiltro);
  if (busca.trim()) lista = lista.filter((l) => combina(`${l.descricao} ${cat.get(l.categoria_id ?? "")?.nome ?? ""}`, busca));
  lista.sort((a, b) => dataDe(b).localeCompare(dataDe(a)));
  const atrasados = lista.filter((l) => dataDe(l) < inicio);
  const doPeriodo = lista.filter((l) => dataDe(l) >= inicio);

  const pagosMes = doMes.filter((l) => l.pago && (l.pago_em ?? l.data).startsWith(mes) && (!contaFiltro || l.conta_id === contaFiltro));
  const recebidos = arred(pagosMes.filter((l) => l.tipo === "entrada").reduce((t, l) => t + l.valor, 0));
  const pagos = arred(pagosMes.filter((l) => l.tipo === "saida").reduce((t, l) => t + l.valor, 0));
  const taxas = arred(pagosMes.filter((l) => l.tipo === "saida" && cat.get(l.categoria_id ?? "")?.dre === "taxa").reduce((t, l) => t + l.valor, 0));
  const saldo = arred((contaFiltro ? ativas.filter((c) => c.id === contaFiltro) : ativas).reduce((t, c) => t + c.saldo, 0));
  const url = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ ...(mesValido(sp.mes) ? { mes } : {}), ...(busca ? { q: busca } : {}), ...(contaFiltro ? { conta: contaFiltro } : {}), ...extra });
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    return `/gestao/financeiro${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <Cabecalho icone="financeiro" titulo="Financeiro" abas={abasFinanceiro("movimentacoes", mesValido(sp.mes) ? mes : undefined)} acao={{ href: "/gestao/financeiro/novo", rotulo: "Adicionar" }} />

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="lg:w-72"><NavMes mes={mes} base="/gestao/financeiro" params={{ q: busca || undefined, conta: contaFiltro || undefined }} /></div>
        <form className="flex flex-1 flex-col gap-2 sm:flex-row" role="search">
          {mesValido(sp.mes) && <input type="hidden" name="mes" value={mes} />}
          <select name="conta" defaultValue={contaFiltro} className="campo py-2.5 sm:w-56" aria-label="Conta">
            <option value="">Todas as contas</option>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-borda bg-white px-3">
            <input name="q" defaultValue={busca} type="search" className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none" placeholder="Buscar no período" aria-label="Buscar lançamentos" />
            <button type="submit" className="text-sm font-semibold text-marca-escura">Buscar</button>
          </div>
        </form>
      </div>

      <ResumoPeriodo
        titulo="Resumo do mês"
        itens={[
          { rotulo: "Saldo atual", valor: saldo, cor: saldo < 0 ? "vermelho" : "verde" },
          { rotulo: "Recebidos", valor: recebidos, cor: "verde", sinal: true },
          { rotulo: "Pagos", valor: -pagos, cor: "vermelho" },
          { rotulo: "Geração de caixa", valor: arred(recebidos - pagos), cor: recebidos - pagos < 0 ? "vermelho" : "verde" },
          { rotulo: "Taxas", valor: -taxas, cor: "vermelho" },
          { rotulo: "Taxa efetiva", valor: recebidos > 0 ? arred((taxas / recebidos) * 100) : 0, formato: "porcento" },
        ]}
      />

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-borda bg-white">
          <Vazio>
            Nenhum lançamento neste mês. <Link href="/gestao/financeiro/novo" className="font-semibold text-marca-escura">Adicionar</Link>
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
          {atrasados.length > 0 && <GrupoMes titulo="Atrasados de meses anteriores" />}
          {atrasados.map((l) => <Linha key={l.id} l={l} hoje={hoje} conta={nomeConta.get(l.conta_id ?? "")} categoria={cat.get(l.categoria_id ?? "")?.nome} contas={ativas} />)}
          {atrasados.length > 0 && doPeriodo.length > 0 && <GrupoMes titulo="Este mês" />}
          {doPeriodo.map((l) => <Linha key={l.id} l={l} hoje={hoje} conta={nomeConta.get(l.conta_id ?? "")} categoria={cat.get(l.categoria_id ?? "")?.nome} contas={ativas} />)}
        </div>
      )}
      {(busca || contaFiltro) && <p className="text-sm text-suave"><Link href={url({ q: "", conta: "" })} className="font-semibold text-marca-escura">Limpar filtros</Link></p>}
    </div>
  );
}

function Linha({ l, hoje, conta, categoria, contas }: { l: Lancamento; hoje: string; conta?: string; categoria?: string; contas: { id: string; nome: string }[] }) {
  const s = situacao(l, hoje);
  const serie = rotuloSerie(l);
  const valor = (
    <span className={`font-semibold tabular-nums ${l.tipo === "saida" ? "text-perigo" : "text-sucesso"}`}>
      {l.tipo === "saida" ? "− " : "+ "}{formatarValor(l.valor)}
    </span>
  );
  const transacao = (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${l.tipo === "saida" ? "bg-perigo-claro text-perigo" : "bg-sucesso-claro text-sucesso"}`}>
        <Icone nome={l.tipo === "saida" ? "saida" : "entrada"} className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        {l.os_id || l.fatura_id ? (
          <Link href={l.os_id ? `/gestao/os/${l.os_id}` : `/gestao/faturas/${l.fatura_id}`} className="block truncate font-medium hover:underline">{l.descricao}</Link>
        ) : (
          <span className="block truncate font-medium">{l.descricao}</span>
        )}
        {serie && <span className="block text-xs text-suave">{serie}</span>}
      </span>
    </span>
  );
  return (
    <div className="rounded-xl border border-borda bg-white text-sm">
      {/* Computador */}
      <div className={`hidden ${COLUNAS} items-stretch lg:grid`}>
        <span className="px-4 py-3 tabular-nums">{formatarData(dataDe(l))}</span>
        <span className="px-3 py-2">{transacao}</span>
        <span className="truncate px-3 py-3 text-suave">{conta ?? "—"}</span>
        <span className="px-3 py-3">{categoria ? <Etiqueta texto={categoria} /> : <span className="text-suave">—</span>}</span>
        <span className="px-3 py-3 text-right">{valor}</span>
        <CelulaStatus texto={s.texto} cor={s.cor} />
        <span className="flex items-center"><AcoesLancamento l={l} contas={contas} hoje={hoje} /></span>
      </div>
      {/* Celular */}
      <div className="flex items-start gap-2 px-3 py-3 lg:hidden">
        <div className="min-w-0 flex-1 space-y-1">
          {transacao}
          <p className="pl-[2.6rem] text-xs text-suave">
            {formatarData(dataDe(l))} · {conta ?? "—"}{categoria && ` · ${categoria}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {valor}
          <span className={`text-xs font-semibold ${s.cor === "verde" ? "text-sucesso" : s.cor === "vermelho" ? "text-perigo" : "text-[#b07800]"}`}>{s.texto}</span>
        </div>
        <AcoesLancamento l={l} contas={contas} hoje={hoje} />
      </div>
    </div>
  );
}
