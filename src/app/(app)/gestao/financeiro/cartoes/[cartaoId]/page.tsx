import type { Metadata } from "next";
import { BandeiraCartao } from "@/components/BandeiraCartao";
import { Icone } from "@/components/gestao/Icones";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Voltar } from "@/components/garagem";
import { Bloco } from "@/components/gestao/Bloco";
import { Cabecalho, Etiqueta } from "@/components/gestao/Cabecalho";
import { FormAcao } from "@/components/gestao/FormAcao";
import { Campo } from "@/components/ui";
import { exigirAdmin } from "@/lib/auth";
import { formatarData, formatarValor, hojeISO } from "@/lib/garagem";
import { arred, datasDaFatura, nomeMes, rotuloSerie, situacaoFaturaCartao, type Lancamento } from "@/lib/gestao";
import { lancamentosCartao, listarCartoes, listarCategorias, listarContas } from "@/lib/gestao-dados";
import { abasFinanceiro } from "../../abas";
import { excluirLancamento } from "../../actions";
import { pagarFaturaCartao } from "../../cartoes-actions";
import { FormLancamento } from "../../FormLancamento";

export const metadata: Metadata = { title: "Cartão de crédito" };

export default async function CartaoPage({ params, searchParams }: PageProps<"/gestao/financeiro/cartoes/[cartaoId]">) {
  const [{ cartaoId }, sp] = await Promise.all([params, searchParams, exigirAdmin()]);
  const [cartoes, compras, contas, categorias] = await Promise.all([listarCartoes(), lancamentosCartao(cartaoId), listarContas(), listarCategorias()]);
  const cartao = cartoes.find((c) => c.id === cartaoId);
  if (!cartao) notFound();
  const hoje = hojeISO();
  const nomeCat = new Map(categorias.map((c) => [c.id, c.nome]));

  // Faturas: compras agrupadas pelo mês do vencimento
  const porMes = new Map<string, Lancamento[]>();
  for (const l of compras) if (l.fatura_mes) porMes.set(l.fatura_mes, [...(porMes.get(l.fatura_mes) ?? []), l]);
  const faturas = [...porMes]
    .map(([mes, itens]) => {
      const total = arred(itens.reduce((t, l) => t + l.valor, 0));
      const emAberto = arred(itens.filter((l) => !l.pago).reduce((t, l) => t + l.valor, 0));
      return { mes, itens, total, emAberto, ...datasDaFatura(mes, cartao), situacao: situacaoFaturaCartao(mes, cartao, emAberto, hoje) };
    })
    .sort((a, b) => a.mes.localeCompare(b.mes));
  const padrao = faturas.find((f) => f.emAberto > 0)?.mes ?? faturas.at(-1)?.mes;
  const escolhida = faturas.find((f) => f.mes === sp.fatura) ?? faturas.find((f) => f.mes === padrao);
  const pagoEm = escolhida?.itens.find((l) => l.pago)?.pago_em;

  return (
    <div className="space-y-4">
      <Cabecalho icone="financeiro" titulo="Financeiro" abas={abasFinanceiro("contas")} />
      <Voltar href="/gestao/financeiro/contas#cartoes">Contas e cartões</Voltar>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-borda bg-white p-4 sm:p-5">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: cartao.cor ?? "#0b1220" }}><Icone nome="cartao" className="h-5 w-5" /></span>
            {cartao.nome}{cartao.final && <span className="font-normal text-suave"> •••• {cartao.final}</span>}
            <BandeiraCartao bandeira={cartao.bandeira} className="h-7 w-10" />
          </h1>
          <p className="text-sm text-suave">Fecha dia {cartao.dia_fechamento} · vence dia {cartao.dia_vencimento}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:flex">
          <div><dt className="text-suave">Em aberto</dt><dd className="font-titulo text-lg font-bold text-perigo tabular-nums">{formatarValor(cartao.em_aberto)}</dd></div>
          {cartao.limite != null && (
            <div><dt className="text-suave">Disponível</dt><dd className="font-titulo text-lg font-bold tabular-nums">{formatarValor(Math.max(0, cartao.limite - cartao.em_aberto))}</dd></div>
          )}
        </dl>
      </section>

      {faturas.length > 0 && (
        <nav aria-label="Faturas" className="flex gap-2 overflow-x-auto pb-1">
          {faturas.map((f) => (
            <Link
              key={f.mes}
              href={`/gestao/financeiro/cartoes/${cartao.id}?fatura=${f.mes}`}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left text-sm ${escolhida?.mes === f.mes ? "border-tinta bg-tinta text-white" : "border-borda bg-white"}`}
            >
              <span className="block font-semibold capitalize">{nomeMes(f.mes).replace(" de ", "/")}</span>
              <span className={`block text-xs ${escolhida?.mes === f.mes ? "text-white/80" : "text-suave"}`}>{formatarValor(f.total)} · {f.situacao.rotulo}</span>
            </Link>
          ))}
        </nav>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {escolhida ? (
          <Bloco
            icone="faturas"
            titulo={`Fatura de ${nomeMes(escolhida.mes).toLowerCase()}`}
            direita={<span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${escolhida.situacao.classe}`}>{escolhida.situacao.rotulo}</span>}
            semEspaco
          >
            <dl className="grid grid-cols-3 gap-2 border-b border-borda p-4 text-center text-sm">
              <div><dt className="text-xs text-suave">Fecha</dt><dd className="font-semibold">{formatarData(escolhida.fechamento)}</dd></div>
              <div><dt className="text-xs text-suave">Vence</dt><dd className="font-semibold">{formatarData(escolhida.vencimento)}</dd></div>
              <div><dt className="text-xs text-suave">Valor</dt><dd className="font-titulo text-lg font-bold tabular-nums">{formatarValor(escolhida.total)}</dd></div>
            </dl>
            <ul className="divide-y divide-borda">
              {escolhida.itens.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.descricao}</p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-suave">
                      Compra {formatarData(l.data)}
                      {rotuloSerie(l) && <span>· {rotuloSerie(l)}</span>}
                      {nomeCat.get(l.categoria_id ?? "") && <Etiqueta texto={nomeCat.get(l.categoria_id ?? "")!} />}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-semibold text-perigo tabular-nums">− {formatarValor(l.valor)}</span>
                    {!l.pago && (
                      <FormAcao acao={excluirLancamento} campos={{ id: l.id }} botao="Apagar" pendente="…" classeBotao="text-xs text-suave underline" className="" confirmar="Apagar esta compra do cartão?" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-borda p-4">
              {escolhida.emAberto > 0 ? (
                <FormAcao acao={pagarFaturaCartao} campos={{ cartao_id: cartao.id, fatura_mes: escolhida.mes }} botao={`Pagar fatura de ${formatarValor(escolhida.emAberto)}`} pendente="Registrando…" confirmar="Registrar o pagamento desta fatura? O valor sai da conta escolhida.">
                  <div className="grid grid-cols-2 gap-3">
                    <Campo rotulo="Pago com a conta">
                      <select name="conta_id" defaultValue={cartao.conta_pagamento_id ?? contas.find((c) => c.ativa)?.id} className="campo px-3">
                        {contas.filter((c) => c.ativa).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </Campo>
                    <Campo rotulo="Data do pagamento">
                      <input type="date" name="data" defaultValue={hoje} className="campo" required />
                    </Campo>
                  </div>
                </FormAcao>
              ) : (
                <p className="text-sm text-sucesso">✓ Fatura paga{pagoEm ? ` em ${formatarData(pagoEm)}` : ""}.</p>
              )}
            </div>
          </Bloco>
        ) : (
          <Bloco icone="faturas" titulo="Faturas">
            <p className="text-sm text-suave">Nenhuma compra neste cartão ainda. Lance a primeira ao lado.</p>
          </Bloco>
        )}

        <Bloco icone="cartao" titulo="Nova compra no cartão">
          <FormLancamento categorias={categorias} contas={contas.filter((c) => c.ativa)} hoje={hoje} cartaoFixo={cartao.id} />
        </Bloco>
      </div>
    </div>
  );
}
