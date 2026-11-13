import type { Metadata } from "next";
import { Cabecalho } from "@/components/gestao/Cabecalho";
import { Icone, type NomeIcone } from "@/components/gestao/Icones";
import { exigirAdmin } from "@/lib/auth";
import Link from "next/link";
import { formatarData, formatarValor } from "@/lib/garagem";
import { FORMAS_PAGAMENTO, TIPOS_CONTA, arred, type Conta } from "@/lib/gestao";
import { contasAPagar, contasAReceberAvulsas, faturasCartaoEmAberto, listarCartoes, listarContas, obterConfig } from "@/lib/gestao-dados";
import { abasFinanceiro } from "../abas";
import { FormCartao } from "../FormCartao";
import { FormConta } from "../FormConta";

export const metadata: Metadata = { title: "Contas" };

const ESTILO: Record<Conta["tipo"], { borda: string; icone: NomeIcone; fundo: string }> = {
  banco: { borda: "border-l-[#e3a008]", icone: "conta", fundo: "bg-[#fff7e0] text-[#8a5a00]" },
  caixa: { borda: "border-l-sucesso", icone: "caixa", fundo: "bg-sucesso-claro text-sucesso" },
  digital: { borda: "border-l-[#6d5bd0]", icone: "cartao", fundo: "bg-[#f1efff] text-[#4b3aa8]" },
  outro: { borda: "border-l-[#3a7be0]", icone: "cartao", fundo: "bg-[#ecf3ff] text-[#2357a8]" },
};

export default async function ContasPage({ searchParams }: PageProps<"/gestao/financeiro/contas">) {
  const [, sp] = await Promise.all([exigirAdmin(), searchParams]);
  const [contas, aPagar, aReceber, config, cartoes, faturas] = await Promise.all([
    listarContas(),
    contasAPagar(),
    contasAReceberAvulsas(),
    obterConfig(),
    listarCartoes(),
    faturasCartaoEmAberto(),
  ]);
  const previsto = (c: Conta) =>
    arred(
      c.saldo +
        aReceber.filter((l) => l.conta_id === c.id).reduce((t, l) => t + l.valor, 0) -
        aPagar.filter((l) => l.conta_id === c.id).reduce((t, l) => t + l.valor, 0) -
        // faturas de cartão em aberto que essa conta costuma pagar
        cartoes.filter((k) => k.conta_pagamento_id === c.id).reduce((t, k) => t + k.em_aberto, 0),
    );
  const total = arred(contas.filter((c) => c.ativa).reduce((t, c) => t + c.saldo, 0));

  return (
    <div className="space-y-4">
      <Cabecalho icone="financeiro" titulo="Financeiro" abas={abasFinanceiro("contas")} acao={{ href: "/gestao/financeiro/contas?nova=1#nova", rotulo: "Nova conta" }} />

      <section className="space-y-4 rounded-2xl border border-borda bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">Estas são as suas contas</h2>
            <p className="text-sm text-suave">Saldo de cada conta e o previsto, contando o que ainda falta pagar e receber.</p>
          </div>
          <p className="text-sm">Total: <strong className={`tabular-nums ${total < 0 ? "text-perigo" : "text-sucesso"}`}>{formatarValor(total)}</strong></p>
        </div>

        {sp.nova && (
          <div id="nova" className="scroll-mt-20">
            <FormConta padrao={config} />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contas.map((c) => {
            const e = ESTILO[c.tipo];
            const p = previsto(c);
            return (
              <article key={c.id} className={`space-y-3 rounded-2xl border border-l-4 border-borda ${e.borda} bg-white p-4 shadow-[0_1px_3px_rgba(11,18,32,0.06)] ${c.ativa ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${e.fundo}`}><Icone nome={e.icone} className="h-6 w-6" /></span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{c.nome}</h3>
                      <p className="text-xs text-suave">{TIPOS_CONTA[c.tipo]}</p>
                    </div>
                  </div>
                  {!c.ativa && <span className="rounded-full bg-fundo px-2.5 py-0.5 text-xs font-semibold text-suave">Inativa</span>}
                </div>
                <div>
                  <p className="text-xs font-medium tracking-wide text-suave uppercase">Saldo atual</p>
                  <p className={`font-titulo text-2xl font-bold tabular-nums ${c.saldo < 0 ? "text-perigo" : "text-sucesso"}`}>{formatarValor(c.saldo)}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-borda pt-2 text-xs">
                  <span className="text-suave">Previsto: <strong className={`tabular-nums ${p < 0 ? "text-perigo" : "text-texto"}`}>{formatarValor(p)}</strong></span>
                  <span className="text-suave">{c.formas.map((f) => FORMAS_PAGAMENTO[f].replace("Cartão de ", "")).join(" · ") || "sem formas"}</span>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-marca-escura">Editar conta, formas e taxas</summary>
                  <div className="mt-2"><FormConta conta={c} padrao={config} /></div>
                </details>
              </article>
            );
          })}
        </div>
      </section>

      {/* Cartões de crédito da empresa */}
      <section id="cartoes" className="scroll-mt-28 space-y-4 rounded-2xl border border-borda bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Icone nome="cartao" className="h-5 w-5 text-suave" />Cartões de crédito</h2>
            <p className="text-sm text-suave">Compras no cartão entram na fatura certa. O dinheiro sai da conta quando você paga a fatura.</p>
          </div>
          {cartoes.length > 0 && <p className="text-sm">Em aberto: <strong className="tabular-nums text-perigo">{formatarValor(arred(cartoes.reduce((t, c) => t + c.em_aberto, 0)))}</strong></p>}
        </div>

        {cartoes.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cartoes.map((c) => {
              const proxima = faturas.find((f) => f.cartao.id === c.id);
              const usado = c.limite ? Math.min(100, Math.round((c.em_aberto / c.limite) * 100)) : null;
              return (
                <article key={c.id} className={`space-y-3 rounded-2xl border border-l-4 border-borda border-l-tinta bg-white p-4 shadow-[0_1px_3px_rgba(11,18,32,0.06)] ${c.ativo ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tinta text-white"><Icone nome="cartao" className="h-6 w-6" /></span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{c.nome}{c.final && <span className="font-normal text-suave"> •••• {c.final}</span>}</h3>
                        <p className="text-xs text-suave">Fecha dia {c.dia_fechamento} · vence dia {c.dia_vencimento}</p>
                      </div>
                    </div>
                    {!c.ativo && <span className="rounded-full bg-fundo px-2.5 py-0.5 text-xs font-semibold text-suave">Inativo</span>}
                  </div>
                  <div>
                    <p className="text-xs font-medium tracking-wide text-suave uppercase">Próxima fatura</p>
                    {proxima ? (
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-titulo text-2xl font-bold text-perigo tabular-nums">{formatarValor(proxima.em_aberto)}</span>
                        <span className="text-sm text-suave">vence {formatarData(proxima.vencimento)}</span>
                      </p>
                    ) : (
                      <p className="font-titulo text-2xl font-bold text-sucesso">Nada em aberto</p>
                    )}
                  </div>
                  {c.limite != null && (
                    <div className="space-y-1">
                      <div className="h-2 overflow-hidden rounded-full bg-fundo"><div className="h-full rounded-full bg-tinta" style={{ width: `${usado}%` }} /></div>
                      <p className="flex justify-between text-xs text-suave">
                        <span>Usado {formatarValor(c.em_aberto)}</span>
                        <span>Disponível <strong className="text-texto">{formatarValor(Math.max(0, c.limite - c.em_aberto))}</strong></span>
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-borda pt-2">
                    <Link href={`/gestao/financeiro/cartoes/${c.id}`} className="text-sm font-semibold text-marca-escura">Ver faturas e lançamentos ›</Link>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm text-suave">Editar cartão</summary>
                    <div className="mt-2"><FormCartao cartao={c} contas={contas.filter((k) => k.ativa)} /></div>
                  </details>
                </article>
              );
            })}
          </div>
        )}

        <details open={cartoes.length === 0 || undefined}>
          <summary className="cursor-pointer text-sm font-semibold text-marca-escura">+ Adicionar cartão de crédito</summary>
          <div className="mt-3 max-w-xl"><FormCartao contas={contas.filter((k) => k.ativa)} /></div>
        </details>
      </section>
    </div>
  );
}
