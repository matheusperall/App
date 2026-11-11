"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { formatarValor } from "@/lib/garagem";
import { FORMAS_PAGAMENTO, taxaPagamento, type ConfigGestao, type FormaPagamento } from "@/lib/gestao";
import { receberOS } from "../actions";

export function FormReceber({ osId, total, contas, config, hoje }: { osId: string; total: number; contas: { id: string; nome: string }[]; config: ConfigGestao; hoje: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(receberOS, {});
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const taxa = taxaPagamento(forma, total, config);
  if (estado.sucesso) return <Aviso tipo="sucesso">{estado.sucesso}</Aviso>;
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="id" value={osId} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Forma de pagamento</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(FORMAS_PAGAMENTO) as FormaPagamento[]).map((f) => (
            <label key={f} className={`cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-medium ${forma === f ? "border-marca bg-marca-clara text-marca-escura" : "border-borda"}`}>
              <input type="radio" name="forma" value={f} checked={forma === f} onChange={() => setForma(f)} className="sr-only" />
              {FORMAS_PAGAMENTO[f]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Entrou na conta">
          <select name="conta_id" className="campo px-3" defaultValue={contas[0]?.id} required>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Data">
          <input type="date" name="data" defaultValue={hoje} className="campo" required />
        </Campo>
      </div>
      <dl className="space-y-1 rounded-xl bg-fundo p-3 text-sm">
        <div className="flex justify-between"><dt className="text-suave">Valor da OS</dt><dd className="tabular-nums">{formatarValor(total)}</dd></div>
        {taxa > 0 && (
          <>
            <div className="flex justify-between"><dt className="text-suave">Taxa da maquininha ({forma === "debito" ? config.taxa_debito : config.taxa_credito}%)</dt><dd className="tabular-nums text-perigo">−{formatarValor(taxa)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Fica para a loja</dt><dd className="tabular-nums">{formatarValor(total - taxa)}</dd></div>
          </>
        )}
      </dl>
      <BotaoEnviar pendente="Registrando…">Registrar pagamento</BotaoEnviar>
    </form>
  );
}
