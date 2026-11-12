"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Campo } from "@/components/ui";
import { formatarValor } from "@/lib/garagem";
import { FORMAS_PAGAMENTO, arred, parcelasAceitas, taxaPercentual, type Conta, type FormaPagamento } from "@/lib/gestao";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/**
 * Escolha de forma de pagamento → conta (só as que aceitam a forma; se for uma, já vem escolhida)
 * → parcelas (no crédito). Mostra a taxa da conta e quanto fica para a loja.
 * Envia no formulário: forma, conta_id, parcelas e data.
 */
export function CamposRecebimento({
  contas,
  valor,
  hoje,
  rotuloValor = "Valor",
  children,
}: {
  contas: Conta[];
  valor: number;
  hoje: string;
  rotuloValor?: string;
  children: (pronto: boolean) => ReactNode;
}) {
  const formasDisponiveis = (Object.keys(FORMAS_PAGAMENTO) as FormaPagamento[]).filter((f) => contas.some((c) => c.formas.includes(f)));
  const [forma, setForma] = useState<FormaPagamento | null>(null);
  const [contaId, setContaId] = useState("");
  const [parcelas, setParcelas] = useState(1);

  const contasDaForma = forma ? contas.filter((c) => c.formas.includes(forma)) : [];
  const conta = contasDaForma.find((c) => c.id === contaId) ?? (contasDaForma.length === 1 ? contasDaForma[0] : null);
  const opcoesParcelas = forma === "credito" && conta ? parcelasAceitas(conta) : [1];
  const nParcelas = opcoesParcelas.includes(parcelas) ? parcelas : 1;
  const percentual = forma && conta ? taxaPercentual(conta, forma, nParcelas) : 0;
  const taxa = arred((valor * percentual) / 100);

  function escolherForma(f: FormaPagamento) {
    setForma(f);
    const daForma = contas.filter((c) => c.formas.includes(f));
    setContaId(daForma.length === 1 ? daForma[0].id : "");
    setParcelas(1);
  }

  if (formasDisponiveis.length === 0)
    return (
      <p className="text-sm text-suave">
        Nenhuma conta tem formas de recebimento marcadas. Configure em{" "}
        <Link href="/gestao/financeiro" className="font-semibold text-marca-escura">Financeiro › Gerenciar contas</Link>.
      </p>
    );

  return (
    <>
      {forma && <input type="hidden" name="forma" value={forma} />}
      {conta && <input type="hidden" name="conta_id" value={conta.id} />}
      <input type="hidden" name="parcelas" value={nParcelas} />

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
              <select
                className="campo px-3"
                value={conta?.id ?? ""}
                onChange={(e) => {
                  setContaId(e.target.value);
                  setParcelas(1);
                }}
                required
              >
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
                    {p === 1 ? "À vista (1x)" : `${p}x de ${formatarValor(arred(valor / p))}`} · taxa {pct(taxaPercentual(conta, "credito", p))}
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
          <div className="flex justify-between"><dt className="text-suave">{rotuloValor}</dt><dd className="tabular-nums">{formatarValor(valor)}</dd></div>
          {taxa > 0 && (
            <>
              <div className="flex justify-between"><dt className="text-suave">Taxa ({pct(percentual)})</dt><dd className="tabular-nums text-perigo">−{formatarValor(taxa)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Fica para a loja</dt><dd className="tabular-nums">{formatarValor(valor - taxa)}</dd></div>
            </>
          )}
        </dl>
      )}

      {children(Boolean(forma && conta))}
    </>
  );
}
