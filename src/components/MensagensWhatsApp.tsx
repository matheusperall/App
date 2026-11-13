"use client";

import { useState } from "react";
import { linkWhatsApp } from "@/lib/gestao";
import type { Mensagem } from "@/lib/mensagens";

/**
 * Mensagens prontas para o cliente: escolhe o tipo, confere (e ajusta) o texto,
 * copia ou abre direto no WhatsApp do cliente.
 */
export function MensagensWhatsApp({ mensagens, telefone, titulo = "Enviar ao cliente" }: { mensagens: Mensagem[]; telefone?: string | null; titulo?: string }) {
  const [chave, setChave] = useState(mensagens[0]?.chave ?? "");
  const [editados, setEditados] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState(false);
  const atual = mensagens.find((m) => m.chave === chave) ?? mensagens[0];
  if (!atual) return null;
  const texto = editados[atual.chave] ?? atual.texto;

  return (
    <section className="space-y-3 rounded-2xl border border-borda bg-cartao p-5 shadow-[0_1px_2px_rgba(11,18,32,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">💬 {titulo}</h2>
        {!telefone && <span className="text-xs text-suave">Cliente sem telefone: escolha o contato no WhatsApp</span>}
      </div>

      {mensagens.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tipo de mensagem">
          {mensagens.map((m) => (
            <button
              key={m.chave}
              type="button"
              role="tab"
              aria-selected={m.chave === atual.chave}
              onClick={() => setChave(m.chave)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                m.chave === atual.chave ? "border-marca bg-marca-clara text-marca-escura" : "border-borda bg-white text-suave hover:text-texto"
              }`}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
      )}

      <textarea
        value={texto}
        onChange={(e) => setEditados((x) => ({ ...x, [atual.chave]: e.target.value }))}
        rows={Math.min(14, Math.max(6, texto.split("\n").length + 1))}
        className="campo font-mono text-sm leading-relaxed"
        aria-label={`Texto: ${atual.rotulo}`}
      />
      {editados[atual.chave] != null && editados[atual.chave] !== atual.texto && (
        <button type="button" onClick={() => setEditados((x) => ({ ...x, [atual.chave]: atual.texto }))} className="-mt-1 text-xs font-semibold text-suave underline">
          Voltar ao texto original
        </button>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="botao-contorno text-sm"
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
          {copiado ? "✓ Copiado!" : "📋 Copiar texto"}
        </button>
        <a href={linkWhatsApp(telefone, texto)} target="_blank" rel="noreferrer" className="botao-primario text-sm">
          Enviar no WhatsApp
        </a>
      </div>
    </section>
  );
}
