"use client";

import { useActionState, useRef, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { Aviso } from "@/components/ui";
import { CAMPOS, EXEMPLO, preencher, type Campo } from "@/lib/mensagens";
import { salvarModeloMensagem } from "./actions";

/** Edita o modelo de uma mensagem: campos para inserir, prévia com dados de exemplo, salvar ou voltar ao padrão. */
export function EditorModelo({ chave, atual, padrao, campos }: { chave: string; atual: string; padrao: string; campos: Campo[] }) {
  const [estado, acao, salvando] = useActionState<EstadoForm, FormData>(salvarModeloMensagem, {});
  const [texto, setTexto] = useState(atual);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const editado = atual !== padrao;

  function inserir(campo: Campo) {
    const t = caixa.current;
    const marca = `{${campo}}`;
    if (!t) return setTexto((x) => x + marca);
    const ini = t.selectionStart ?? texto.length;
    const fim = t.selectionEnd ?? texto.length;
    setTexto(texto.slice(0, ini) + marca + texto.slice(fim));
    requestAnimationFrame(() => {
      t.focus();
      t.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  }

  return (
    <form action={acao} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <input type="hidden" name="chave" value={chave} />
      <div className="min-w-0 space-y-2">
        {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
        <textarea
          ref={caixa}
          name="texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={Math.min(18, Math.max(6, texto.split("\n").length + 1))}
          className="campo font-mono text-sm leading-relaxed"
          aria-label="Texto do modelo"
        />
        <div>
          <p className="mb-1.5 text-xs text-suave">Toque num campo para colocar no texto (ele é trocado pelos dados do cliente):</p>
          <div className="flex flex-wrap gap-1.5">
            {campos.map((c) => (
              <button key={c} type="button" onClick={() => inserir(c)} title={CAMPOS[c]} className="rounded-full border border-borda bg-white px-2.5 py-1 font-mono text-xs text-marca-escura hover:border-marca">
                {`{${c}}`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" disabled={salvando} className="botao-primario px-5 py-2.5 text-sm">
            {salvando ? "Salvando…" : "Salvar modelo"}
          </button>
          {(editado || texto !== padrao) && (
            <button
              type="submit"
              name="restaurar"
              value="sim"
              disabled={salvando}
              onClick={() => setTexto(padrao)}
              className="botao-contorno px-4 py-2.5 text-sm"
            >
              Voltar ao padrão
            </button>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <p className="mb-1.5 text-xs font-semibold text-suave">Prévia (com dados de exemplo)</p>
        <div className="rounded-xl bg-[#e7f6ee] p-3">
          <p className="rounded-lg bg-white px-3 py-2 text-sm whitespace-pre-wrap shadow-sm">{preencher(texto, EXEMPLO) || "—"}</p>
        </div>
        <p className="mt-1.5 text-xs text-suave">Linhas com um campo vazio somem sozinhas (ex.: “Obs.: {"{observacoes}"}” quando não há observação).</p>
      </div>
    </form>
  );
}
