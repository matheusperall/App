"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { Aviso, Cartao } from "@/components/ui";
import { decidirOrcamento } from "../actions";

export function Decisao({ id, situacao }: { id: string; situacao: "solicitado" | "respondido" }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(decidirOrcamento, {});
  const [recusando, setRecusando] = useState(false);

  if (estado.sucesso) return <Aviso tipo="sucesso">{estado.sucesso}</Aviso>;

  if (situacao === "solicitado") {
    return (
      <form action={acao} className="text-center">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decisao" value="cancelado" />
        <button
          type="submit"
          disabled={pendente}
          onClick={(e) => {
            if (!confirm("Cancelar este pedido de orçamento?")) e.preventDefault();
          }}
          className="text-sm font-medium text-suave underline"
        >
          Cancelar pedido
        </button>
        {estado.erro && <p className="mt-2 text-sm text-perigo">{estado.erro}</p>}
      </form>
    );
  }

  return (
    <Cartao className="space-y-3">
      <h2 className="font-semibold">O que você decide?</h2>
      {!recusando ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <form action={acao}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="decisao" value="aceito" />
            <button type="submit" disabled={pendente} className="botao-primario w-full">
              {pendente ? "Enviando…" : "✓ Aprovar orçamento"}
            </button>
          </form>
          <button type="button" onClick={() => setRecusando(true)} className="botao-contorno w-full">
            Recusar
          </button>
        </div>
      ) : (
        <form action={acao} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decisao" value="recusado" />
          <textarea name="motivo" rows={3} className="campo" placeholder="Opcional: conte o motivo (valor, prazo, vou fazer depois…). Isso nos ajuda a melhorar." />
          <div className="flex gap-2">
            <button type="submit" disabled={pendente} className="botao-escuro flex-1">{pendente ? "Enviando…" : "Confirmar recusa"}</button>
            <button type="button" onClick={() => setRecusando(false)} className="botao px-4 text-suave">Voltar</button>
          </div>
        </form>
      )}
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
    </Cartao>
  );
}
