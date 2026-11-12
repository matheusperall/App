"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { formatarValor } from "@/lib/garagem";
import { FORMAS_PAGAMENTO, arred, parcelasAceitas, taxaPercentual, type Conta, type FormaPagamento } from "@/lib/gestao";
import { receberOS } from "../actions";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export function FormReceber({ osId, total, contas, hoje }: { osId: string; total: number; contas: Conta[]; hoje: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(receberOS, {});
  const formasDisponiveis = (Object.keys(FORMAS_PAGAMENTO) as FormaPagamento[]).filter((f) => contas.some((c) => c.formas.includes(f)));
  const [forma, setForma] = useState<FormaPagamento | null>(null);
  const [contaId, setContaId] = useState("");
  const [parcelas, setParcelas] = useState(1);

  // Contas que recebem na forma escolhida (se houver só uma, já vem escolhida)
  const contasDaForma = forma ? contas.filter((c) => c.formas.includes(forma)) : [];
  const conta = contasDaForma.find((c) => c.id === contaId) ?? (contasDaForma.length === 1 ? contasDaForma[0] : null);
  const opcoesParcelas = forma === "credito" && conta ? parcelasAceitas(conta) : [1];
  const nParcelas = opcoesParcelas.includes(parcelas) ? parcelas : 1;
  const percentual = forma && conta ? taxaPercentual(conta, forma, nParcelas) : 0;
  const taxa = arred((total * percentual) / 100);

  function escolherForma(f: FormaPagamento) {
    setForma(f);
    const daForma = contas.filter((c) => c.formas.includes(f));
    setContaId(daForma.length === 1 ? daForma[0].id : "");
    setParcelas(1);
  }

  if (estado.sucesso) return <Aviso tipo="sucesso">{estado.sucesso}</Aviso>;
  if (formasDisponiveis.length === 0)
    return (
      <p className="text-sm text-suave">
        Nenhuma conta tem formas de recebimento marcadas. Configure em <Link href="/gestao/financeiro" className="font-semibold text-marca-escura">Financeiro › Gerenciar contas</Link>.
      </p>
    );

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="id" value={osId} />
      {forma && <input type="hidden" name="forma" value={forma} />}
      {conta && <input type="hidden" name="conta_id" value={conta.id} />}
      <input type="hidden" name="parcelas" value={nParcelas} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Forma de pagamento</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {formasDisponiveis.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={forma === f}
              onClick={() => escolherForma(f)}
              className={`rounded-xl border px-3 py-2 text-center text-sm font-medium ${forma === f ? "border-marca bg-marca-clara text-marca-escura" : "border-borda bg-white"}`}
            >
              {FORMAS_PAGAMENTO[f]}
            </button>
          ))}
        </div>
      </fieldset>

      {forma && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Recebido na conta">
            {contasDaForma.length === 1 ? (
              <p className="campo bg-fundo">{contasDaForma[0].nome}</p>
            ) : (
              <select className="campo px-3" value={conta?.id ?? ""} onChange={(e) => { setContaId(e.target.value); setParcelas(1); }} required>
                <option value="" disabled>Escolha a conta…</option>
                {contasDaForma.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
          </Campo>
          {forma === "credito" && conta && (
            <Campo rotulo="Parcelas">
              <select className="campo px-3" value={nParcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
                {opcoesParcelas.map((p) => (
                  <option key={p} value={p}>
                    {p === 1 ? "À vista (1x)" : `${p}x de ${formatarValor(arred(total / p))}`} · taxa {pct(taxaPercentual(conta, "credito", p))}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          <Campo rotulo="Data">
            <input type="date" name="data" defaultValue={hoje} className="campo" required />
          </Campo>
        </div>
      )}

      {forma && conta && (
        <dl className="space-y-1 rounded-xl bg-fundo p-3 text-sm">
          <div className="flex justify-between"><dt className="text-suave">Valor da OS</dt><dd className="tabular-nums">{formatarValor(total)}</dd></div>
          {taxa > 0 && (
            <>
              <div className="flex justify-between"><dt className="text-suave">Taxa ({pct(percentual)})</dt><dd className="tabular-nums text-perigo">−{formatarValor(taxa)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Fica para a loja</dt><dd className="tabular-nums">{formatarValor(total - taxa)}</dd></div>
            </>
          )}
        </dl>
      )}

      <BotaoEnviar pendente="Registrando…" className={`botao-primario w-full ${!forma || !conta ? "pointer-events-none opacity-50" : ""}`}>
        Registrar pagamento
      </BotaoEnviar>
    </form>
  );
}
