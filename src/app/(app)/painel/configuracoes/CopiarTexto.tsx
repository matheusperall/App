"use client";

import { useState } from "react";

export function CopiarTexto({ rotulo, valor, secreto = false }: { rotulo: string; valor: string; secreto?: boolean }) {
  const [copiado, setCopiado] = useState<"" | "nome" | "valor">("");
  const copiar = async (texto: string, qual: "nome" | "valor") => {
    await navigator.clipboard.writeText(texto);
    setCopiado(qual);
    setTimeout(() => setCopiado(""), 1500);
  };
  return (
    <div className="space-y-1.5 rounded-xl bg-fundo p-3">
      <div className="flex items-center justify-between gap-2">
        <code className="text-xs font-semibold break-all">{rotulo}</code>
        <button type="button" onClick={() => copiar(rotulo, "nome")} className="shrink-0 text-xs font-semibold text-marca-escura">
          {copiado === "nome" ? "Copiado!" : "Copiar nome"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 text-xs">{secreto ? "•".repeat(24) : valor}</code>
        <button type="button" onClick={() => copiar(valor, "valor")} className="botao-escuro shrink-0 px-3 py-1.5 text-xs">
          {copiado === "valor" ? "Copiado!" : "Copiar valor"}
        </button>
      </div>
    </div>
  );
}
