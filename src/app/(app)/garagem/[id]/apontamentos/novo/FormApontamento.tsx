"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { EnviarFotos } from "@/components/EnviarFotos";
import { Aviso, Campo } from "@/components/ui";
import { CATEGORIAS, PRIORIDADES, type Categoria, type Prioridade } from "@/lib/garagem";
import { criarApontamento } from "../../../apontamentos-actions";

const SUGESTOES: Record<Categoria, string[]> = {
  estetica: ["Pintura sem brilho / oxidada", "Manchas de chuva ácida", "Bancos precisam de higienização", "Faróis amarelados"],
  funilaria_pintura: ["Risco na porta", "Amassado no para-lama", "Pintura descascando", "Para-choque trincado"],
  mecanica: ["Pastilhas de freio no limite", "Pneus gastos", "Vazamento de óleo", "Barulho na suspensão"],
  eletrica: ["Bateria fraca", "Lâmpada queimada", "Luz de alerta no painel"],
  acessorios: ["Película danificada", "Palheta do limpador ressecada"],
  outros: [],
};

export function FormApontamento({ veiculoId, donoId }: { veiculoId: string; donoId: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(criarApontamento, {});
  const [categoria, setCategoria] = useState<Categoria>("funilaria_pintura");
  const [prioridade, setPrioridade] = useState<Prioridade>("media");
  const [titulo, setTitulo] = useState("");

  return (
    <form action={acao} className="ficha">
      <input type="hidden" name="veiculo_id" value={veiculoId} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <Campo rotulo="Categoria" largo>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Object.entries(CATEGORIAS).map(([k, v]) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                categoria === k ? "border-marca bg-marca-clara font-semibold text-marca-escura" : "border-borda bg-white"
              }`}
            >
              <input type="radio" name="categoria" value={k} checked={categoria === k} onChange={() => setCategoria(k as Categoria)} className="sr-only" />
              <span aria-hidden="true">{v.icone}</span> {v.rotulo}
            </label>
          ))}
        </div>
      </Campo>

      <Campo rotulo="O que foi identificado?">
        <input name="titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)} className="campo" placeholder="Ex.: Risco na porta traseira direita" />
      </Campo>
      <Campo rotulo="Prioridade">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PRIORIDADES) as Prioridade[])
            .sort((a, b) => PRIORIDADES[b].ordem - PRIORIDADES[a].ordem)
            .map((k) => (
              <label
                key={k}
                className={`cursor-pointer rounded-xl border px-1.5 py-2.5 text-center text-xs transition sm:text-sm ${
                  prioridade === k ? `border-transparent font-semibold ring-2 ring-marca ${PRIORIDADES[k].classe}` : "border-borda bg-white"
                }`}
              >
                <input type="radio" name="prioridade" value={k} checked={prioridade === k} onChange={() => setPrioridade(k)} className="sr-only" />
                {PRIORIDADES[k].rotulo}
              </label>
            ))}
        </div>
      </Campo>

      {SUGESTOES[categoria].length > 0 && (
        <div className="-mt-1 flex flex-wrap gap-2">
          {SUGESTOES[categoria].map((s) => (
            <button key={s} type="button" onClick={() => setTitulo(s)} className="rounded-full border border-borda bg-white px-3 py-1 text-xs text-suave hover:border-marca hover:text-marca-escura">
              {s}
            </button>
          ))}
        </div>
      )}

      <Campo rotulo="Explicação para o cliente" dica="Explique de forma simples o que é e por que é importante resolver.">
        <textarea name="descricao" rows={4} className="campo" placeholder="Ex.: O risco chegou no primer. Recomendamos repintura localizada para evitar ferrugem." />
      </Campo>

      <Campo rotulo="Fotos" dica="Fotos ajudam muito o cliente a entender. Até 8." largo>
        <EnviarFotos pasta={`${donoId}/${veiculoId}`} maximo={8} />
      </Campo>

      <BotaoEnviar pendente="Enviando…">Registrar e avisar o cliente</BotaoEnviar>
    </form>
  );
}
