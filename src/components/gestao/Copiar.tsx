"use client";

import { useState } from "react";

/** Copia um texto (ex.: resumo para colar no WhatsApp) e, se houver telefone, oferece abrir a conversa. */
export function CopiarWhatsApp({ texto, rotulo = "Copiar para WhatsApp", link }: { texto: string; rotulo?: string; link?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        className="botao-contorno flex-1 text-sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
          } catch {
            prompt("Copie o texto:", texto);
          }
        }}
      >
        {copiado ? "✓ Copiado!" : `📋 ${rotulo}`}
      </button>
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="botao-contorno flex-1 text-sm">
          💬 Abrir no WhatsApp
        </a>
      )}
    </div>
  );
}
