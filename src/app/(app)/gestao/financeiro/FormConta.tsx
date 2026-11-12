"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso } from "@/components/ui";
import { FORMAS_PAGAMENTO, MAX_PARCELAS, TIPOS_CONTA, valorCampo, type Conta, type FormaPagamento } from "@/lib/gestao";
import { salvarConta } from "./actions";

const pctCampo = (v: number | undefined) => (v == null ? "" : String(v).replace(".", ","));

function CampoTaxa({ nome, rotulo, valor, vazio = "0" }: { nome: string; rotulo: string; valor?: number; vazio?: string }) {
  return (
    <label className="block text-xs text-suave">
      {rotulo}
      <span className="mt-1 flex items-center gap-1">
        <input name={nome} defaultValue={pctCampo(valor)} inputMode="decimal" placeholder={vazio} className="campo px-2 py-2 text-right" />
        <span className="text-sm">%</span>
      </span>
    </label>
  );
}

/** Conta (caixa, banco, maquininha…): quais formas ela recebe e as taxas de cada uma. */
export function FormConta({ conta, padrao }: { conta?: Conta; padrao: { taxa_debito: number; taxa_credito: number } }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(salvarConta, {});
  const [formas, setFormas] = useState<FormaPagamento[]>(conta?.formas ?? []);
  const tem = (f: FormaPagamento) => formas.includes(f);
  const alternar = (f: FormaPagamento) => setFormas((l) => (l.includes(f) ? l.filter((x) => x !== f) : [...l, f]));

  return (
    <form action={acao} className="space-y-3 rounded-xl bg-fundo p-3" key={conta ? undefined : estado.sucesso}>
      {conta && <input type="hidden" name="id" value={conta.id} />}
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      {!conta && <p className="text-sm font-semibold">Nova conta</p>}
      <div className="grid grid-cols-[1fr_8rem] gap-2">
        <input name="nome" defaultValue={conta?.nome} placeholder="Ex.: Maquininha, Nubank" className="campo py-2" aria-label="Nome da conta" required />
        <select name="tipo" defaultValue={conta?.tipo ?? "banco"} className="campo px-2 py-2" aria-label="Tipo">
          {Object.entries(TIPOS_CONTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <label className="block text-xs text-suave">
        Saldo inicial (R$)
        <input name="saldo_inicial" defaultValue={conta ? valorCampo(conta.saldo_inicial) : ""} placeholder="0,00" inputMode="decimal" className="campo mt-1 py-2" />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-xs text-suave">Formas de recebimento nesta conta</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FORMAS_PAGAMENTO) as FormaPagamento[]).map((f) => (
            <label key={f} className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium ${tem(f) ? "border-marca bg-white text-marca-escura" : "border-borda text-suave"}`}>
              <input type="checkbox" name="formas" value={f} checked={tem(f)} onChange={() => alternar(f)} className="sr-only" />
              {tem(f) ? "✓ " : ""}{FORMAS_PAGAMENTO[f]}
            </label>
          ))}
        </div>
      </fieldset>

      {(tem("pix") || tem("debito") || tem("credito")) && (
        <div className="grid grid-cols-3 gap-2">
          {tem("pix") && <CampoTaxa nome="taxa_pix" rotulo="Taxa Pix" valor={conta?.taxa_pix} />}
          {tem("debito") && <CampoTaxa nome="taxa_debito" rotulo="Taxa débito" valor={conta ? conta.taxa_debito : padrao.taxa_debito} />}
          {tem("credito") && <CampoTaxa nome="taxa_credito" rotulo="Crédito à vista" valor={conta ? conta.taxa_credito : padrao.taxa_credito} />}
        </div>
      )}

      {tem("credito") && (
        <fieldset className="space-y-1.5">
          <legend className="text-xs text-suave">Crédito parcelado — taxa de cada parcela (deixe vazio as que não aceita)</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: MAX_PARCELAS - 1 }, (_, i) => i + 2).map((p) => (
              <CampoTaxa key={p} nome={`parc_${p}`} rotulo={`${p}x`} valor={conta?.taxas_parcelado[String(p)]} vazio="—" />
            ))}
          </div>
        </fieldset>
      )}

      {conta && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativa" defaultChecked={conta.ativa} className="h-4 w-4 accent-marca" /> Conta ativa</label>
      )}
      <BotaoEnviar pendente="Salvando…" className={conta ? "botao-contorno w-full text-sm" : "botao-primario w-full text-sm"}>
        {conta ? "Salvar conta" : "+ Criar conta"}
      </BotaoEnviar>
    </form>
  );
}
