"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { formatarKm } from "@/lib/garagem";
import { atualizarKm } from "../actions";

export function FormKm({ veiculoId, kmAtual }: { veiculoId: string; kmAtual: number }) {
  const [editando, setEditando] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(async (e, f) => {
    const r = await atualizarKm(e, f);
    if (r.sucesso) setEditando(false);
    return r;
  }, {});

  if (!editando) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-fundo px-4 py-3">
        <div>
          <p className="text-xs text-suave">Hodômetro</p>
          <p className="font-titulo text-xl font-bold">{formatarKm(kmAtual)}</p>
        </div>
        <button type="button" onClick={() => setEditando(true)} className="text-sm font-semibold text-marca-escura hover:underline">
          Atualizar
        </button>
        {estado.sucesso && <span className="sr-only" role="status">{estado.sucesso}</span>}
      </div>
    );
  }

  return (
    <form action={acao} className="space-y-2 rounded-xl bg-fundo p-3">
      <input type="hidden" name="id" value={veiculoId} />
      <label className="block text-xs text-suave" htmlFor="km-novo">Quilometragem atual</label>
      <div className="flex gap-2">
        <input id="km-novo" name="km" inputMode="numeric" autoFocus required defaultValue={kmAtual} className="campo py-2" />
        <button type="submit" disabled={pendente} className="botao-escuro px-4 py-2 text-sm">
          {pendente ? "…" : "Salvar"}
        </button>
        <button type="button" onClick={() => setEditando(false)} className="botao px-3 py-2 text-sm text-suave">
          Cancelar
        </button>
      </div>
      {estado.erro && <p className="text-sm text-perigo">{estado.erro}</p>}
    </form>
  );
}
