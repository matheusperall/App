"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import type { CategoriaFinanceira } from "@/lib/gestao";
import { salvarLancamento } from "./actions";

export function FormLancamento({ categorias, contas, hoje }: { categorias: CategoriaFinanceira[]; contas: { id: string; nome: string }[]; hoje: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(salvarLancamento, {});
  const [tipo, setTipo] = useState<"saida" | "entrada">("saida");
  const [pago, setPago] = useState(true);
  const cats = categorias.filter((c) => c.tipo === tipo && c.ativa && !c.sistema?.match(/^(os|fatura|taxa)$/));
  return (
    <form action={acao} className="space-y-3" key={estado.sucesso}>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      <div className="grid grid-cols-2 gap-2">
        {(["saida", "entrada"] as const).map((t) => (
          <label key={t} className={`cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-semibold ${tipo === t ? (t === "saida" ? "border-perigo bg-perigo-claro text-perigo" : "border-sucesso bg-sucesso-claro text-sucesso") : "border-borda"}`}>
            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
            {t === "saida" ? "− Saída (despesa)" : "+ Entrada"}
          </label>
        ))}
      </div>
      <Campo rotulo="Descrição">
        <input name="descricao" required className="campo" placeholder={tipo === "saida" ? "Ex.: Conta de luz" : "Ex.: Venda de acessório"} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor (R$)">
          <input name="valor" required inputMode="decimal" className="campo" />
        </Campo>
        <Campo rotulo="Mês de referência" dica="Data em que a despesa conta no resultado">
          <input name="data" type="date" defaultValue={hoje} required className="campo" />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Categoria">
          <select name="categoria_id" className="campo px-3">
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            <option value="">Sem categoria</option>
          </select>
        </Campo>
        <Campo rotulo="Conta">
          <select name="conta_id" className="campo px-3" defaultValue={contas[0]?.id}>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
      </div>
      <div className="flex gap-2 text-sm">
        {[{ v: true, r: tipo === "saida" ? "Já paguei" : "Já recebi" }, { v: false, r: tipo === "saida" ? "A pagar" : "A receber" }].map((o) => (
          <label key={String(o.v)} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center font-medium ${pago === o.v ? "border-marca bg-marca-clara text-marca-escura" : "border-borda"}`}>
            <input type="radio" name="pago" value={o.v ? "sim" : "nao"} checked={pago === o.v} onChange={() => setPago(o.v)} className="sr-only" />
            {o.r}
          </label>
        ))}
      </div>
      {!pago && (
        <Campo rotulo="Vencimento">
          <input name="vencimento" type="date" required className="campo" />
        </Campo>
      )}
      <BotaoEnviar pendente="Salvando…">Registrar</BotaoEnviar>
    </form>
  );
}
