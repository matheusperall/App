"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { CampoDinheiro } from "@/components/CampoDinheiro";
import { Aviso, Campo } from "@/components/ui";
import { formatarValor } from "@/lib/garagem";
import { FORMAS_PAGAMENTO, arred, parcelasAceitas, taxaPercentual, type Conta, type FormaPagamento } from "@/lib/gestao";
import { receberOS } from "../actions";

type Pagamento = { chave: number; valor: number; forma: FormaPagamento | null; contaId: string; parcelas: number; aberto: boolean };

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const ordinal = (i: number) => `${i + 1}º pagamento`;
let proxima = 1;

/** Conta escolhida do pagamento: a que ele marcou, ou a única que aceita a forma. */
function contaDe(p: Pagamento, contas: Conta[]) {
  if (!p.forma) return null;
  const daForma = contas.filter((c) => c.formas.includes(p.forma!));
  return daForma.find((c) => c.id === p.contaId) ?? (daForma.length === 1 ? daForma[0] : null);
}

/**
 * Recebimento da OS em um ou mais pagamentos (ex.: parte no Pix, parte no crédito).
 * Cada pagamento tem valor, forma, conta (só as que aceitam a forma) e parcelas no crédito.
 * Se a soma for menor que o total, o restante fica em aberto para receber depois.
 */
export function FormReceber({ osId, falta, contas, hoje }: { osId: string; falta: number; contas: Conta[]; hoje: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(receberOS, {});
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([{ chave: proxima++, valor: falta, forma: null, contaId: "", parcelas: 1, aberto: true }]);
  const formasDisponiveis = (Object.keys(FORMAS_PAGAMENTO) as FormaPagamento[]).filter((f) => contas.some((c) => c.formas.includes(f)));

  const soma = arred(pagamentos.reduce((t, p) => t + p.valor, 0));
  const restante = arred(falta - soma);
  const taxaDe = (p: Pagamento) => {
    const c = contaDe(p, contas);
    return c && p.forma ? arred((p.valor * taxaPercentual(c, p.forma, p.parcelas)) / 100) : 0;
  };
  const taxas = arred(pagamentos.reduce((t, p) => t + taxaDe(p), 0));
  const completos = pagamentos.every((p) => p.valor > 0 && p.forma && contaDe(p, contas));
  const pronto = completos && soma > 0 && restante >= -0.001;

  const mudar = (chave: number, dados: Partial<Pagamento>) => setPagamentos((l) => l.map((p) => (p.chave === chave ? { ...p, ...dados } : p)));

  if (estado.sucesso) return <Aviso tipo="sucesso">{estado.sucesso}</Aviso>;
  if (formasDisponiveis.length === 0)
    return (
      <p className="text-sm text-suave">
        Nenhuma conta tem formas de recebimento marcadas. Configure em <Link href="/gestao/financeiro/contas" className="font-semibold text-marca-escura">Financeiro › Contas</Link>.
      </p>
    );

  const enviados = pagamentos.map((p) => ({ valor: p.valor, forma: p.forma, conta_id: contaDe(p, contas)?.id ?? null, parcelas: p.forma === "credito" ? p.parcelas : 1 }));

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="id" value={osId} />
      <input type="hidden" name="pagamentos" value={JSON.stringify(enviados)} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      {pagamentos.map((p, i) => {
        const daForma = p.forma ? contas.filter((c) => c.formas.includes(p.forma!)) : [];
        const conta = contaDe(p, contas);
        const opcoesParcelas = p.forma === "credito" && conta ? parcelasAceitas(conta) : [1];
        const restanteAntes = arred(falta - pagamentos.filter((x) => x.chave !== p.chave).reduce((t, x) => t + x.valor, 0) - p.valor);
        return (
          <div key={p.chave} className="overflow-hidden rounded-xl border border-borda">
            <button type="button" onClick={() => mudar(p.chave, { aberto: !p.aberto })} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm">
              <span className="font-semibold">
                {ordinal(i)}
                {!p.aberto && p.forma && <span className="font-normal text-suave"> · {FORMAS_PAGAMENTO[p.forma]}{conta ? ` · ${conta.nome}` : ""} · {formatarValor(p.valor)}</span>}
              </span>
              <span className={`shrink-0 text-xs font-semibold ${restanteAntes > 0.001 ? "text-[#b07800]" : restanteAntes < -0.001 ? "text-perigo" : "text-sucesso"}`}>
                {restanteAntes > 0.001 ? `${formatarValor(restanteAntes)} restantes` : restanteAntes < -0.001 ? "valor acima do total" : "fecha o total"} {p.aberto ? "▴" : "▾"}
              </span>
            </button>
            {p.aberto && (
              <div className="space-y-3 border-t border-borda p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Valor (R$)">
                    <CampoDinheiro valor={p.valor} aoMudar={(v) => mudar(p.chave, { valor: v })} />
                  </Campo>
                  <Campo rotulo="Forma de pagamento">
                    <select
                      className="campo px-3"
                      value={p.forma ?? ""}
                      onChange={(e) => {
                        const f = e.target.value as FormaPagamento;
                        const opcoes = contas.filter((c) => c.formas.includes(f));
                        mudar(p.chave, { forma: f, contaId: opcoes.length === 1 ? opcoes[0].id : "", parcelas: 1 });
                      }}
                    >
                      <option value="" disabled>Selecionar…</option>
                      {formasDisponiveis.map((f) => <option key={f} value={f}>{FORMAS_PAGAMENTO[f]}</option>)}
                    </select>
                  </Campo>
                  {p.forma && (
                    <Campo rotulo="Conta">
                      {daForma.length === 1 ? (
                        <p className="campo bg-fundo">{daForma[0].nome}</p>
                      ) : (
                        <select className="campo px-3" value={conta?.id ?? ""} onChange={(e) => mudar(p.chave, { contaId: e.target.value, parcelas: 1 })}>
                          <option value="" disabled>Escolha a conta…</option>
                          {daForma.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      )}
                    </Campo>
                  )}
                  {p.forma === "credito" && conta && (
                    <Campo rotulo="Parcelas">
                      <select className="campo px-3" value={opcoesParcelas.includes(p.parcelas) ? p.parcelas : 1} onChange={(e) => mudar(p.chave, { parcelas: Number(e.target.value) })}>
                        {opcoesParcelas.map((n) => (
                          <option key={n} value={n}>
                            {n === 1 ? "À vista (1x)" : `${n}x de ${formatarValor(arred(p.valor / n))}`} · taxa {pct(taxaPercentual(conta, "credito", n))}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  )}
                </div>
                {taxaDe(p) > 0 && <p className="text-xs text-suave">Taxa deste pagamento: <span className="text-perigo">−{formatarValor(taxaDe(p))}</span></p>}
                {pagamentos.length > 1 && (
                  <button type="button" className="text-sm text-perigo underline" onClick={() => setPagamentos((l) => l.filter((x) => x.chave !== p.chave))}>
                    Remover este pagamento
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {restante > 0.001 && (
        <div className="flex justify-end">
          <button
            type="button"
            className="text-sm font-semibold text-marca-escura"
            onClick={() =>
              setPagamentos((l) => [...l.map((p) => ({ ...p, aberto: false })), { chave: proxima++, valor: restante, forma: null, contaId: "", parcelas: 1, aberto: true }])
            }
          >
            + Adicionar {pagamentos.length + 1}º pagamento
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Data do recebimento">
          <input type="date" name="data" defaultValue={hoje} className="campo" required />
        </Campo>
      </div>

      <dl className="space-y-1 rounded-xl bg-fundo p-4 text-sm">
        <div className="flex justify-between"><dt className="text-suave">Falta receber</dt><dd className="tabular-nums">{formatarValor(falta)}</dd></div>
        <div className="flex justify-between"><dt className="text-suave">Recebendo agora</dt><dd className="tabular-nums">{formatarValor(soma)}</dd></div>
        {taxas > 0 && <div className="flex justify-between"><dt className="text-suave">Taxas</dt><dd className="tabular-nums text-perigo">−{formatarValor(taxas)}</dd></div>}
        {restante > 0.001 && <div className="flex justify-between font-semibold text-[#b07800]"><dt>Fica em aberto</dt><dd className="tabular-nums">{formatarValor(restante)}</dd></div>}
        {restante < -0.001 && <p className="font-semibold text-perigo">Os pagamentos passam do que falta receber.</p>}
        <div className="flex justify-between pt-1 text-base font-bold"><dt>Fica para a loja</dt><dd className="tabular-nums text-sucesso">{formatarValor(arred(soma - taxas))}</dd></div>
      </dl>

      <BotaoEnviar pendente="Registrando…" className={`botao-primario w-full ${pronto ? "" : "pointer-events-none opacity-50"}`}>
        {restante > 0.001 ? "Registrar e deixar o restante em aberto" : "Registrar pagamento"}
      </BotaoEnviar>
    </form>
  );
}
