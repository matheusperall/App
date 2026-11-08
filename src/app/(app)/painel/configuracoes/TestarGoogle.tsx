"use client";

import { useState, useTransition } from "react";
import { testarConexaoGoogle } from "./actions";

export function TestarGoogle() {
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pendente}
        onClick={() => iniciar(async () => setMsg((await testarConexaoGoogle()).mensagem))}
        className="botao-contorno text-sm"
      >
        {pendente ? "Testando…" : "Testar conexão"}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
