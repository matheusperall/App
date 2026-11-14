import type { Metadata } from "next";
import Link from "next/link";
import { NavMes } from "@/components/gestao";
import { Bloco } from "@/components/gestao/Bloco";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { GraficoFluxo } from "@/components/gestao/GraficoFluxo";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, formatarValor, hojeISO, somarDias } from "@/lib/garagem";
import { arred, limitesMes, mesAtual, mesValido } from "@/lib/gestao";
import { comprasNosCartoes, contasAPagar, contasAReceberAvulsas, lancamentosPeriodo, listarCartoes, listarCategorias, listarContas, resumoGestao } from "@/lib/gestao-dados";
import { abasFinanceiro } from "../abas";
import { montarMovimentos } from "../movimentos";

export const metadata: Metadata = { title: "Resumo financeiro" };

const FORMAS: Record<string, string> = { pix: "Pix", dinheiro: "Dinheiro", credito: "Crédito", debito: "Débito", transferencia: "Transferência", faturas: "Faturas de lojistas" };

/** Barra de participação (valor / total), com nome, % e valor escritos */
function LinhaBarra({ nome, valor, total, cor }: { nome: string; valor: number; total: number; cor: string }) {
  const pct = total > 0 ? (valor / total) * 100 : 0;
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{nome}</span>
        <span className="shrink-0 tabular-nums">
          <span className="mr-2 text-xs text-suave">{pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
          <strong>{formatarValor(valor)}</strong>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-fundo">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, valor > 0 ? 1 : 0)}%`, background: cor }} />
      </div>
    </li>
  );
}

export default async function ResumoFinanceiroPage({ searchParams }: PageProps<"/gestao/financeiro/resumo">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const mes = mesValido(sp.mes) ? sp.mes : mesAtual();
  const { inicio, fim } = limitesMes(mes);
  const hoje = hojeISO();
  const [contas, categorias, doMes, aPagar, aReceber, cartoes, compras, r] = await Promise.all([
    listarContas(),
    listarCategorias(),
    lancamentosPeriodo(inicio, fim),
    contasAPagar(),
    contasAReceberAvulsas(),
    listarCartoes(),
    comprasNosCartoes(),
    resumoGestao(mes),
  ]);
  const cat = new Map(categorias.map((c) => [c.id, c]));
  const saldo = arred(contas.filter((c) => c.ativa).reduce((t, c) => t + c.saldo, 0));

  // Movimentações do mês (cartões entram pelo pagamento da fatura), sem transferências entre contas
  const movs = montarMovimentos({ de: inicio, ate: fim, lancamentos: doMes, compras, cartoes, categorias, contas }).filter((m) => !m.transferencia);
  const soma = (l: { valor: number }[]) => arred(l.reduce((t, m) => t + m.valor, 0));
  const entradas = soma(movs.filter((m) => m.tipo === "entrada" && m.pago));
  const saidas = soma(movs.filter((m) => m.tipo === "saida" && m.pago));
  const aPagarMes = soma(movs.filter((m) => m.tipo === "saida" && !m.pago));

  // Pendências: o que vence hoje e o que já venceu (contas a pagar/receber e faturas de cartão)
  const todasPendentes = montarMovimentos({ de: "0000-01-01", ate: somarDias(hoje, 0), lancamentos: [...aPagar, ...aReceber], compras: compras.filter((c) => !c.pago), cartoes, categorias, contas }).filter((m) => !m.pago);
  const venceHoje = todasPendentes.filter((m) => m.data === hoje).length;
  const vencidos = todasPendentes.filter((m) => m.data < hoje).length;

  // Top categorias das saídas do mês: pela competência (compras no cartão pela categoria de cada compra)
  const porCategoria = new Map<string, number>();
  for (const l of doMes) {
    const c = cat.get(l.categoria_id ?? "");
    if (l.tipo !== "saida" || c?.dre === "fora") continue;
    const competencia = l.cartao_id ? l.data : l.pago ? (l.pago_em ?? l.data) : null;
    if (!competencia || competencia < inicio || competencia > fim) continue;
    const nome = c?.nome ?? "Sem categoria";
    porCategoria.set(nome, arred((porCategoria.get(nome) ?? 0) + l.valor));
  }
  const topSaidas = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
  const totalSaidasCat = arred(topSaidas.reduce((t, [, v]) => t + v, 0));
  const formas = r.porForma.filter((f) => f.valor > 0).sort((a, b) => b.valor - a.valor);
  const totalFormas = arred(formas.reduce((t, f) => t + f.valor, 0));

  // Fluxo de caixa diário
  const dias = Array.from({ length: Number(fim.slice(8)) }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`).map((dia) => ({
    dia,
    entradas: soma(movs.filter((m) => m.pago && m.tipo === "entrada" && m.data === dia)),
    saidas: soma(movs.filter((m) => m.pago && m.tipo === "saida" && m.data === dia)),
  }));
  const geracao = arred(entradas - saidas);
  const cor = (v: number) => (v < 0 ? "text-perigo" : "text-sucesso");

  return (
    <div className="space-y-4">
      <Cabecalho icone="financeiro" titulo="Financeiro" abas={abasFinanceiro("resumo", mesValido(sp.mes) ? mes : undefined)} acao={{ href: "/gestao/financeiro/novo", rotulo: "Adicionar" }} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="px-1">
          <p className="text-sm text-suave">Saldo atual · {formatarData(hoje)}</p>
          <p className={`font-titulo text-3xl font-bold tabular-nums ${cor(saldo)}`}>{formatarValor(saldo)}</p>
        </div>
        <div className="w-full sm:w-72"><NavMes mes={mes} base="/gestao/financeiro/resumo" /></div>
      </div>

      {venceHoje + vencidos > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e3a008]/50 bg-alerta-claro px-4 py-3">
          <div className="text-sm">
            <p className="font-semibold text-[#8a5a00]">⚠️ Você tem {venceHoje + vencidos} {venceHoje + vencidos === 1 ? "pendência" : "pendências"} para resolver</p>
            <p className="text-texto">{venceHoje} {venceHoje === 1 ? "vence" : "vencem"} hoje · {vencidos} {vencidos === 1 ? "vencida" : "vencidas"}</p>
          </div>
          <Link href={`/gestao/financeiro?de=2020-01-01&ate=${hoje}&situacao=vencidas,receber_vencidas`} className="botao-primario rounded-full px-4 py-2 text-sm">Resolver pendências</Link>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold">Resumo do mês</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { rotulo: "Entradas do mês", valor: entradas, classe: "text-sucesso", sinal: "+" },
            { rotulo: "Saídas do mês", valor: saidas, classe: "text-perigo", sinal: "−" },
            { rotulo: "Geração de caixa", valor: geracao, classe: cor(geracao), sinal: "" },
            { rotulo: "A pagar no mês", valor: aPagarMes, classe: "text-perigo", sinal: "" },
          ].map((k) => (
            <div key={k.rotulo} className="rounded-2xl border border-borda bg-white px-4 py-3">
              <p className="text-xs text-suave">{k.rotulo}</p>
              <p className={`font-titulo text-xl font-bold tabular-nums ${k.classe}`}>{k.sinal}{formatarValor(Math.abs(k.valor)).replace("R$", k.valor < 0 && !k.sinal ? "−R$" : "R$")}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Bloco icone="entrada" titulo="Top 5 formas de pagamento das entradas" direita={<span className="text-xs text-suave">{formatarData(inicio)} a {formatarData(fim)}</span>}>
          {formas.length === 0 ? (
            <p className="text-sm text-suave">Nenhum recebimento neste mês.</p>
          ) : (
            <ul className="space-y-3">
              {formas.slice(0, 5).map((f) => <LinhaBarra key={f.chave} nome={FORMAS[f.chave] ?? f.chave} valor={f.valor} total={totalFormas} cor="#1f9d55" />)}
            </ul>
          )}
          <Link href={`/gestao/financeiro?de=${inicio}&ate=${fim}&tipo=entradas`} className="mt-3 block text-center text-sm font-semibold text-marca-escura">Ver detalhes</Link>
        </Bloco>
        <Bloco icone="saida" titulo="Top 7 categorias das saídas" direita={<span className="text-xs text-suave">{formatarData(inicio)} a {formatarData(fim)}</span>}>
          {topSaidas.length === 0 ? (
            <p className="text-sm text-suave">Nenhuma saída neste mês.</p>
          ) : (
            <ul className="space-y-3">
              {topSaidas.slice(0, 7).map(([nome, valor]) => <LinhaBarra key={nome} nome={nome} valor={valor} total={totalSaidasCat} cor="#c2410c" />)}
            </ul>
          )}
          <Link href={`/gestao/financeiro?de=${inicio}&ate=${fim}&tipo=saidas`} className="mt-3 block text-center text-sm font-semibold text-marca-escura">Ver detalhes</Link>
        </Bloco>
      </div>

      <Bloco icone="financeiro" titulo="Fluxo de caixa diário">
        <GraficoFluxo dias={dias} hoje={hoje} />
        <div className="mt-3 grid grid-cols-3 divide-x divide-borda border-t border-borda pt-3 text-center">
          <div><p className="text-xs text-suave">Entradas</p><p className="font-semibold text-sucesso tabular-nums">{formatarValor(entradas)}</p></div>
          <div><p className="text-xs text-suave">Saídas</p><p className="font-semibold text-perigo tabular-nums">{formatarValor(saidas)}</p></div>
          <div><p className="text-xs text-suave">Geração de caixa</p><p className={`font-semibold tabular-nums ${cor(geracao)}`}>{formatarValor(geracao)}</p></div>
        </div>
      </Bloco>
    </div>
  );
}
