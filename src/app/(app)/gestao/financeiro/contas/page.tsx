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
import { BandeiraCartao } from "@/components/BandeiraCartao";
import { Aviso } from "@/components/ui";

export const metadata: Metadata = { title: "Contas" };

/** Ícone e cores de cada tipo de conta */
const ESTILO: Record<Conta["tipo"], { cor: string; icone: NomeIcone; fundo: string }> = {
  banco: { cor: "#2563eb", icone: "banco", fundo: "bg-[#ecf3ff] text-[#2357a8]" },
  caixa: { cor: "#16a34a", icone: "dinheiro", fundo: "bg-sucesso-claro text-sucesso" },
  maquininha: { cor: "#6d5bd0", icone: "maquininha", fundo: "bg-[#f1efff] text-[#4b3aa8]" },
  digital: { cor: "#e3a008", icone: "cartao", fundo: "bg-[#fff7e0] text-[#8a5a00]" },
  outro: { cor: "#6b7280", icone: "conta", fundo: "bg-fundo text-suave" },
};

/** Lápis de edição no canto do quadro */
function LapisEditar({ href, rotulo }: { href: string; rotulo: string }) {
  return (
    <Link href={href} scroll={false} aria-label={rotulo} title={rotulo} className="rounded-lg p-1.5 text-suave transition hover:bg-fundo hover:text-marca-escura">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
        <path d="m13.5 6.5 4 4" />
      </svg>
    </Link>
  );
}

/** Painel de edição que abre acima da lista (pelo lápis) */
function PainelEdicao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div id="editar" className="scroll-mt-24 space-y-3 rounded-2xl border border-marca/40 bg-marca-clara/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{titulo}</h3>
        <Link href="/gestao/financeiro/contas" scroll={false} className="text-sm font-semibold text-suave hover:text-texto">Fechar ✕</Link>
      </div>
      {children}
    </div>
  );
}

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
  const editandoConta = typeof sp.conta === "string" ? contas.find((c) => c.id === sp.conta) : undefined;
  const editandoCartao = typeof sp.cartao === "string" ? cartoes.find((c) => c.id === sp.cartao) : undefined;
  const contasAtivas = contas.filter((k) => k.ativa);

  return (
    <div className="space-y-4">
      <Cabecalho icone="financeiro" titulo="Financeiro" abas={abasFinanceiro("contas")} acao={{ href: "/gestao/financeiro/contas?nova=1#editar", rotulo: "Nova conta" }} />

      {typeof sp.salvo === "string" && <Aviso tipo="sucesso">{sp.salvo}</Aviso>}

      <section className="space-y-3 rounded-2xl border border-borda bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">Contas</h2>
            <p className="text-sm text-suave">Saldo de cada conta e o previsto, contando o que ainda falta pagar e receber. Toque no lápis para editar.</p>
          </div>
          <p className="text-sm">Total: <strong className={`tabular-nums ${total < 0 ? "text-perigo" : "text-sucesso"}`}>{formatarValor(total)}</strong></p>
        </div>

        {sp.nova && (
          <PainelEdicao titulo="Nova conta">
            <FormConta padrao={config} />
          </PainelEdicao>
        )}
        {editandoConta && (
          <PainelEdicao titulo={`Editar conta: ${editandoConta.nome}`}>
            <FormConta key={editandoConta.id} conta={editandoConta} padrao={config} />
          </PainelEdicao>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {contas.map((c) => {
            const e = ESTILO[c.tipo] ?? ESTILO.outro;
            const p = previsto(c);
            return (
              <article
                key={c.id}
                className={`rounded-xl border border-l-4 border-borda bg-white px-3.5 py-3 ${c.ativa ? "" : "opacity-60"} ${editandoConta?.id === c.id ? "ring-2 ring-marca/50" : ""}`}
                style={{ borderLeftColor: e.cor }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${e.fundo}`}><Icone nome={e.icone} className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{c.nome}{!c.ativa && <span className="font-normal text-suave"> · inativa</span>}</h3>
                      <p className="truncate text-xs text-suave">{TIPOS_CONTA[c.tipo] ?? c.tipo}</p>
                    </div>
                  </div>
                  <LapisEditar href={`/gestao/financeiro/contas?conta=${c.id}#editar`} rotulo={`Editar ${c.nome}`} />
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <p className={`font-titulo text-xl font-bold tabular-nums ${c.saldo < 0 ? "text-perigo" : "text-sucesso"}`}>{formatarValor(c.saldo)}</p>
                  <p className="text-right text-xs text-suave">Previsto <strong className={`tabular-nums ${p < 0 ? "text-perigo" : "text-texto"}`}>{formatarValor(p)}</strong></p>
                </div>
                <p className="mt-1 truncate text-xs text-suave">{c.formas.map((f) => FORMAS_PAGAMENTO[f].replace("Cartão de ", "")).join(" · ") || "sem formas de recebimento"}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Cartões de crédito da empresa */}
      <section id="cartoes" className="scroll-mt-28 space-y-3 rounded-2xl border border-borda bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Icone nome="cartao" className="h-5 w-5 text-suave" />Cartões de crédito</h2>
            <p className="text-sm text-suave">Compras no cartão entram na fatura certa. O dinheiro sai da conta quando você paga a fatura.</p>
          </div>
          <div className="flex items-center gap-3">
            {cartoes.length > 0 && <p className="text-sm">Em aberto: <strong className="tabular-nums text-perigo">{formatarValor(arred(cartoes.reduce((t, c) => t + c.em_aberto, 0)))}</strong></p>}
            <Link href="/gestao/financeiro/contas?novo_cartao=1#editar" scroll={false} className="botao-contorno gap-1 rounded-full px-3 py-1.5 text-sm">+ Cartão</Link>
          </div>
        </div>

        {(sp.novo_cartao || cartoes.length === 0) && (
          <PainelEdicao titulo="Novo cartão de crédito">
            <FormCartao contas={contasAtivas} />
          </PainelEdicao>
        )}
        {editandoCartao && (
          <PainelEdicao titulo={`Editar cartão: ${editandoCartao.nome}`}>
            <FormCartao key={editandoCartao.id} cartao={editandoCartao} contas={contasAtivas} />
          </PainelEdicao>
        )}

        {cartoes.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cartoes.map((c) => {
              const proxima = faturas.find((f) => f.cartao.id === c.id);
              const usado = c.limite ? Math.min(100, Math.round((c.em_aberto / c.limite) * 100)) : null;
              const cor = c.cor ?? "#0b1220";
              return (
                <article
                  key={c.id}
                  className={`rounded-xl border border-l-4 border-borda bg-white px-3.5 py-3 ${c.ativo ? "" : "opacity-60"} ${editandoCartao?.id === c.id ? "ring-2 ring-marca/50" : ""}`}
                  style={{ borderLeftColor: cor }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: cor }}><Icone nome="cartao" className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{c.nome}{c.final && <span className="font-normal text-suave"> •••• {c.final}</span>}{!c.ativo && <span className="font-normal text-suave"> · inativo</span>}</h3>
                        <p className="truncate text-xs text-suave">Fecha dia {c.dia_fechamento} · vence dia {c.dia_vencimento}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <BandeiraCartao bandeira={c.bandeira} />
                      <LapisEditar href={`/gestao/financeiro/contas?cartao=${c.id}#editar`} rotulo={`Editar ${c.nome}`} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    {proxima ? (
                      <p className="font-titulo text-xl font-bold text-perigo tabular-nums">{formatarValor(proxima.em_aberto)}</p>
                    ) : (
                      <p className="font-titulo text-base font-bold text-sucesso">Nada em aberto</p>
                    )}
                    {proxima && <p className="text-right text-xs text-suave">vence {formatarData(proxima.vencimento)}</p>}
                  </div>
                  {c.limite != null && (
                    <div className="mt-1.5 space-y-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-fundo"><div className="h-full rounded-full" style={{ width: `${usado}%`, background: cor }} /></div>
                      <p className="flex justify-between text-xs text-suave">
                        <span>Usado {formatarValor(c.em_aberto)}</span>
                        <span>Disponível <strong className="text-texto">{formatarValor(Math.max(0, c.limite - c.em_aberto))}</strong></span>
                      </p>
                    </div>
                  )}
                  <Link href={`/gestao/financeiro/cartoes/${c.id}`} className="mt-1.5 inline-block text-xs font-semibold text-marca-escura">Ver faturas e lançamentos ›</Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
