"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { formatarValor } from "@/lib/garagem";
import { arred, lerDinheiro, lerNumero, type Produto } from "@/lib/gestao";
import { reporProduto } from "../actions";

export function FormRepor({ produto, contas }: { produto: Produto; contas: { id: string; nome: string }[] }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(reporProduto, {});
  const [qtd, setQtd] = useState("");
  const [valor, setValor] = useState("");
  const [lancar, setLancar] = useState(true);
  const [pago, setPago] = useState(true);
  const q = lerNumero(qtd) ?? 0;
  const v = lerDinheiro(valor) ?? 0;
  const novoCusto = q > 0 ? (produto.saldo > 0 ? (produto.saldo * produto.custo_medio + v) / (produto.saldo + q) : v / q) : null;

  return (
    <form action={acao} className="space-y-3" key={estado.sucesso}>
      <input type="hidden" name="id" value={produto.id} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo={`Quantidade (${produto.unidade})`}>
          <input name="quantidade" inputMode="decimal" className="campo" value={qtd} onChange={(e) => setQtd(e.target.value)} required />
        </Campo>
        <Campo rotulo="Valor total pago (R$)">
          <input name="valor" inputMode="decimal" className="campo" value={valor} onChange={(e) => setValor(e.target.value)} required />
        </Campo>
      </div>
      {novoCusto != null && (
        <p className="text-xs text-suave">Novo custo médio: <strong className="text-texto">{formatarValor(arred(novoCusto * 10000) / 10000)}</strong> por {produto.unidade}</p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="lancar" checked={lancar} onChange={(e) => setLancar(e.target.checked)} className="h-4 w-4 accent-marca" />
        Lançar a compra como saída no financeiro
      </label>
      {lancar && (
        <div className="space-y-3 rounded-xl bg-fundo p-3">
          <div className="flex gap-2 text-sm">
            {[{ v: true, r: "Já paguei" }, { v: false, r: "Vou pagar depois" }].map((o) => (
              <label key={String(o.v)} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center font-medium ${pago === o.v ? "border-marca bg-white text-marca-escura" : "border-borda"}`}>
                <input type="radio" name="pago" value={o.v ? "sim" : "nao"} checked={pago === o.v} onChange={() => setPago(o.v)} className="sr-only" />
                {o.r}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Conta">
              <select name="conta_id" className="campo px-3" defaultValue={contas[0]?.id}>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
            {!pago && (
              <Campo rotulo="Vencimento">
                <input type="date" name="vencimento" className="campo" required />
              </Campo>
            )}
          </div>
          <p className="text-xs text-suave">Compra de produto não entra como despesa no resultado: ela vira estoque e o custo aparece quando o produto é usado nas OS.</p>
        </div>
      )}
      <BotaoEnviar pendente="Registrando…">Registrar reposição</BotaoEnviar>
    </form>
  );
}
