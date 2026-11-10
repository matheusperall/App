"use client";

import { useActionState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { reenviarAcesso } from "../actions";

export function ReenviarAcesso({ clienteId }: { clienteId: string }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(reenviarAcesso, {});
  return (
    <form action={acao} className="space-y-1">
      <input type="hidden" name="cliente_id" value={clienteId} />
      <button type="submit" disabled={pendente} className="botao-contorno w-full text-sm">
        {pendente ? "Enviando…" : "Reenviar acesso por e-mail"}
      </button>
      {estado.sucesso && <p className="text-xs text-sucesso">{estado.sucesso}</p>}
      {estado.erro && <p className="text-xs text-perigo">{estado.erro}</p>}
    </form>
  );
}
