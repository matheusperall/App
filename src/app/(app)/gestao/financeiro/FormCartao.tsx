"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { CampoDinheiro } from "@/components/CampoDinheiro";
import { Aviso, Campo } from "@/components/ui";
import { BANDEIRAS, CORES_CARTAO, type Bandeira, type Cartao } from "@/lib/gestao";
import { BandeiraCartao } from "@/components/BandeiraCartao";
import { salvarCartao } from "./cartoes-actions";

/** Cadastro/edição de cartão de crédito da empresa. */
export function FormCartao({ cartao, contas }: { cartao?: Cartao; contas: { id: string; nome: string }[] }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(salvarCartao, {});
  const [cor, setCor] = useState<string>(cartao?.cor ?? CORES_CARTAO[0]);
  const [bandeira, setBandeira] = useState<Bandeira | "">(cartao?.bandeira ?? "");
  return (
    <form action={acao} className="space-y-3 rounded-xl bg-fundo p-3" key={cartao ? undefined : estado.sucesso}>
      {cartao && <input type="hidden" name="id" value={cartao.id} />}
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      {!cartao && <p className="text-sm font-semibold">Novo cartão de crédito</p>}
      <div className="grid grid-cols-[1fr_7rem] gap-2">
        <Campo rotulo="Nome do cartão">
          <input name="nome" defaultValue={cartao?.nome} required className="campo py-2" placeholder="Ex.: Nubank PJ" />
        </Campo>
        <Campo rotulo="Final (opcional)">
          <input name="final" defaultValue={cartao?.final ?? ""} inputMode="numeric" maxLength={4} className="campo py-2" placeholder="1234" />
        </Campo>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Campo rotulo="Dia do fechamento">
          <input name="dia_fechamento" defaultValue={cartao?.dia_fechamento ?? ""} inputMode="numeric" maxLength={2} required className="campo py-2" placeholder="5" />
        </Campo>
        <Campo rotulo="Dia do vencimento">
          <input name="dia_vencimento" defaultValue={cartao?.dia_vencimento ?? ""} inputMode="numeric" maxLength={2} required className="campo py-2" placeholder="12" />
        </Campo>
        <Campo rotulo="Limite (opcional)">
          <CampoDinheiro name="limite" valorInicial={cartao?.limite ?? 0} className="campo py-2" />
        </Campo>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_16rem]">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Cor do cartão</legend>
          <input type="hidden" name="cor" value={cor} />
          <div className="flex flex-wrap gap-2">
            {CORES_CARTAO.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={cor === c}
                className={`h-8 w-8 rounded-full border-2 transition ${cor === c ? "border-texto ring-2 ring-marca/40" : "border-white shadow"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        <Campo rotulo="Bandeira">
          <div className="flex items-center gap-2">
            <select name="bandeira" value={bandeira} onChange={(e) => setBandeira(e.target.value as Bandeira | "")} className="campo px-3 py-2">
              <option value="">Não informar</option>
              {(Object.keys(BANDEIRAS) as Bandeira[]).map((b) => <option key={b} value={b}>{BANDEIRAS[b]}</option>)}
            </select>
            <BandeiraCartao bandeira={bandeira || null} className="h-8 w-12" />
          </div>
        </Campo>
      </div>
      <Campo rotulo="Conta que paga a fatura">
        <select name="conta_pagamento_id" defaultValue={cartao?.conta_pagamento_id ?? contas[0]?.id} className="campo px-3 py-2">
          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>
      {cartao && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="ativo" defaultChecked={cartao.ativo} className="h-4 w-4 accent-marca" /> Cartão ativo</label>
      )}
      <BotaoEnviar pendente="Salvando…" className={cartao ? "botao-contorno w-full text-sm" : "botao-primario w-full text-sm"}>
        {cartao ? "Salvar cartão" : "+ Cadastrar cartão"}
      </BotaoEnviar>
    </form>
  );
}
