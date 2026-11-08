"use client";

import { useState, useTransition } from "react";
import { executarLembretesAgora } from "./actions";

export function ExecutarLembretes() {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pendente}
        onClick={() => iniciar(async () => setMsg((await executarLembretesAgora()).mensagem))}
        className="botao-contorno text-sm"
      >
        {pendente ? "Verificando…" : "Verificar e enviar agora"}
      </button>
      {msg && <p className="text-sm text-suave">{msg}</p>}
    </div>
  );
}
