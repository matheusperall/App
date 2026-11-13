"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { CampoDinheiro } from "@/components/CampoDinheiro";
import { Aviso, Campo } from "@/components/ui";
import { formatarValor } from "@/lib/garagem";
import { arred, type CategoriaFinanceira } from "@/lib/gestao";
import { salvarLancamento } from "./actions";

export function FormLancamento({
  categorias,
  contas,
  hoje,
  cartoes = [],
  cartaoFixo,
}: {
  categorias: CategoriaFinanceira[];
  contas: { id: string; nome: string }[];
  hoje: string;
  /** Cartões de crédito: uma saída pode ser paga com cartão (entra na fatura) */
  cartoes?: { id: string; nome: string }[];
  /** Na tela do cartão: o lançamento é sempre uma compra nele */
  cartaoFixo?: string;
}) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(salvarLancamento, {});
  const [tipo, setTipo] = useState<"saida" | "entrada">("saida");
  const [pago, setPago] = useState(true);
  const [valor, setValor] = useState(0);
  const [repeticao, setRepeticao] = useState<"unica" | "recorrente" | "parcelado">("unica");
  const [vezes, setVezes] = useState(repeticao === "parcelado" ? 2 : 12);
  // "Pago com": conta (conta:<id>) ou cartão de crédito (cartao:<id>)
  const [pagoCom, setPagoCom] = useState(cartaoFixo ? `cartao:${cartaoFixo}` : `conta:${contas[0]?.id ?? ""}`);
  const noCartao = (cartaoFixo || tipo === "saida") && pagoCom.startsWith("cartao:");
  const cats = categorias.filter((c) => c.tipo === tipo && c.ativa && !c.sistema?.match(/^(os|fatura|taxa)$/));
  return (
    <form action={acao} className="ficha" key={estado.sucesso}>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      {cartaoFixo ? <input type="hidden" name="tipo" value="saida" /> : (
      <div className="grid grid-cols-2 gap-2">
        {(["saida", "entrada"] as const).map((t) => (
          <label key={t} className={`cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-semibold ${tipo === t ? (t === "saida" ? "border-perigo bg-perigo-claro text-perigo" : "border-sucesso bg-sucesso-claro text-sucesso") : "border-borda"}`}>
            <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
            {t === "saida" ? "− Saída (despesa)" : "+ Entrada"}
          </label>
        ))}
      </div>
      )}
      <Campo rotulo="Descrição">
        <input name="descricao" required className="campo" placeholder={tipo === "saida" ? "Ex.: Conta de luz" : "Ex.: Venda de acessório"} />
      </Campo>
        <Campo obrigatorio rotulo={repeticao === "parcelado" ? "Valor total (R$)" : repeticao === "recorrente" ? "Valor por mês (R$)" : "Valor (R$)"}>
          <CampoDinheiro name="valor" valor={valor} aoMudar={setValor} />
        </Campo>
        <Campo rotulo={noCartao ? "Data da compra" : "Mês de referência"} dica={noCartao ? "Define em qual fatura a compra entra" : "Data em que a despesa conta no resultado"}>
          <input name="data" type="date" defaultValue={hoje} required className="campo" />
        </Campo>
        <Campo rotulo="Categoria">
          <select name="categoria_id" className="campo px-3">
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            <option value="">Sem categoria</option>
          </select>
        </Campo>
        {cartaoFixo ? (
          <input type="hidden" name="cartao_id" value={cartaoFixo} />
        ) : (
          <Campo rotulo={tipo === "saida" ? "Pago com" : "Conta"}>
            <select className="campo px-3" value={tipo === "saida" ? pagoCom : `conta:${pagoCom.startsWith("conta:") ? pagoCom.slice(6) : contas[0]?.id}`} onChange={(e) => setPagoCom(e.target.value)}>
              <optgroup label="Contas">
                {contas.map((c) => <option key={c.id} value={`conta:${c.id}`}>{c.nome}</option>)}
              </optgroup>
              {tipo === "saida" && cartoes.length > 0 && (
                <optgroup label="Cartões de crédito">
                  {cartoes.map((c) => <option key={c.id} value={`cartao:${c.id}`}>💳 {c.nome}</option>)}
                </optgroup>
              )}
            </select>
          </Campo>
        )}
        {!cartaoFixo && (noCartao ? <input type="hidden" name="cartao_id" value={pagoCom.slice(7)} /> : <input type="hidden" name="conta_id" value={pagoCom.startsWith("conta:") ? pagoCom.slice(6) : (contas[0]?.id ?? "")} />)}
      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-medium">Repetição</legend>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {([["unica", "Única"], ["recorrente", "Recorrente"], ["parcelado", "Parcelado"]] as const).map(([v, r]) => (
            <label key={v} className={`cursor-pointer rounded-lg border px-3 py-2 text-center font-medium ${repeticao === v ? "border-marca bg-marca-clara text-marca-escura" : "border-borda"}`}>
              <input
                type="radio"
                name="repeticao"
                value={v}
                checked={repeticao === v}
                onChange={() => {
                  setRepeticao(v);
                  setVezes(v === "parcelado" ? 2 : 12);
                }}
                className="sr-only"
              />
              {r}
            </label>
          ))}
        </div>
        {repeticao !== "unica" && (
          <div className="flex items-center gap-3 rounded-xl bg-fundo p-3 text-sm">
            <label className="flex items-center gap-2">
              {repeticao === "parcelado" ? "Em" : "Por"}
              <input
                name="vezes"
                type="number"
                min={2}
                max={repeticao === "parcelado" ? 48 : 60}
                value={vezes}
                onChange={(e) => setVezes(Math.max(2, Math.min(repeticao === "parcelado" ? 48 : 60, Number(e.target.value) || 2)))}
                className="campo w-20 px-2 py-2 text-center"
              />
              {repeticao === "parcelado" ? "parcelas" : "meses"}
            </label>
            <span className="text-suave">
              {repeticao === "parcelado"
                ? `${vezes}x de ${formatarValor(arred(valor / vezes))}`
                : `${formatarValor(valor)} todo mês`}
            </span>
          </div>
        )}
        {repeticao !== "unica" && (
          <p className="text-xs text-suave">
            A primeira fica como você marcar abaixo; as próximas entram como {tipo === "saida" ? "contas a pagar" : "valores a receber"}, uma por mês, com o mesmo dia de vencimento.
          </p>
        )}
      </fieldset>
      {noCartao ? (
        <p className="rounded-xl bg-fundo p-3 text-xs text-suave">
          💳 Compra no cartão: entra na fatura certa pela data (e pelo fechamento do cartão). Conta como despesa no mês da compra; o dinheiro sai da conta quando a fatura for paga.
        </p>
      ) : (
      <div className="flex gap-2 text-sm">
        {[{ v: true, r: tipo === "saida" ? "Já paguei" : "Já recebi" }, { v: false, r: tipo === "saida" ? "A pagar" : "A receber" }].map((o) => (
          <label key={String(o.v)} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center font-medium ${pago === o.v ? "border-marca bg-marca-clara text-marca-escura" : "border-borda"}`}>
            <input type="radio" name="pago" value={o.v ? "sim" : "nao"} checked={pago === o.v} onChange={() => setPago(o.v)} className="sr-only" />
            {o.r}
          </label>
        ))}
      </div>
      )}
      {!noCartao && !pago && (
        <Campo rotulo="Vencimento">
          <input name="vencimento" type="date" required className="campo" />
        </Campo>
      )}
      <BotaoEnviar pendente="Salvando…">Registrar</BotaoEnviar>
    </form>
  );
}
