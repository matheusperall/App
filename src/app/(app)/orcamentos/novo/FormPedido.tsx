"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { EnviarFotos } from "@/components/EnviarFotos";
import { Aviso, Campo } from "@/components/ui";
import { CATEGORIAS, type Categoria } from "@/lib/garagem";
import { pedirOrcamento } from "../actions";

export function FormPedido({
  veiculos,
  veiculoInicial,
}: {
  veiculos: { id: string; nome: string; donoId: string }[];
  veiculoInicial: string;
}) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(pedirOrcamento, {});
  const [veiculoId, setVeiculoId] = useState(veiculoInicial);
  const [categoria, setCategoria] = useState<Categoria>("estetica");
  const veiculo = veiculos.find((v) => v.id === veiculoId) ?? veiculos[0];

  return (
    <form action={acao} className="ficha">
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {veiculos.length > 1 ? (
        <Campo rotulo="Veículo">
          <select name="veiculo_id" value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className="campo">
            {veiculos.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </Campo>
      ) : (
        <input type="hidden" name="veiculo_id" value={veiculo.id} />
      )}

      <Campo rotulo="Tipo de serviço" largo>
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

      <Campo rotulo="O que você precisa?">
        <textarea name="pedido" required rows={4} className="campo" placeholder="Ex.: Quero polir o carro e aplicar vitrificação. Tem alguns riscos leves no capô (fotos)." />
      </Campo>

      <Campo rotulo="Fotos" dica="Fotos ajudam a gente a passar um valor mais preciso. Até 8." largo>
        <EnviarFotos key={veiculo.id} pasta={`${veiculo.donoId}/${veiculo.id}`} maximo={8} />
      </Campo>

      <BotaoEnviar pendente="Enviando…">Enviar pedido</BotaoEnviar>
    </form>
  );
}
