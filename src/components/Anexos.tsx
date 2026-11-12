"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { registrarAnexo, removerAnexo } from "@/app/(app)/garagem/anexos-actions";
import { isSupabaseConfigured } from "@/lib/env";
import { TIPOS_ANEXO, formatarData, type Anexo, type TipoAnexo } from "@/lib/garagem";
import { createClient } from "@/lib/supabase/client";

const TAMANHO_MAX = 10 * 1024 * 1024;
const tamanho = (b: number | null) => (b == null ? "" : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/**
 * Lista de arquivos anexados (PDF ou foto) com botão para anexar mais.
 * `pasta` é a pasta do dono no Storage; `veiculoId` vazio = documento pessoal (CNH).
 */
export function Anexos({
  anexos,
  pasta,
  veiculoId,
  tipos,
}: {
  anexos: Anexo[];
  pasta: string;
  veiculoId?: string;
  /** Tipos que podem ser escolhidos (o primeiro vem marcado) */
  tipos: TipoAnexo[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<TipoAnexo>(tipos[0]);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ erro?: string; sucesso?: string }>({});

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    setMensagem({});
    if (!isSupabaseConfigured) return setMensagem({ erro: "Modo demonstração: o envio de arquivos funciona depois de conectar o banco." });
    if (arquivo.size > TAMANHO_MAX) return setMensagem({ erro: "Arquivo grande demais (máximo 10 MB)." });
    if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(arquivo.type)) return setMensagem({ erro: "Envie um PDF ou uma foto (JPG, PNG)." });
    setEnviando(true);
    try {
      const ext = arquivo.type === "application/pdf" ? "pdf" : arquivo.type.split("/")[1].replace("jpeg", "jpg");
      const caminho = `${pasta}/${veiculoId ?? "pessoal"}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient().storage.from("documentos").upload(caminho, arquivo, { contentType: arquivo.type });
      if (error) throw error;
      const f = new FormData();
      f.set("tipo", tipo);
      f.set("caminho", caminho);
      f.set("nome", arquivo.name);
      f.set("tamanho", String(arquivo.size));
      f.set("tipo_mime", arquivo.type);
      if (veiculoId) f.set("veiculo_id", veiculoId);
      const r = await registrarAnexo({}, f);
      setMensagem(r);
      if (r.sucesso) router.refresh();
    } catch {
      setMensagem({ erro: "Não foi possível enviar o arquivo. Tente novamente." });
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {anexos.length > 0 && (
        <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda">
          {anexos.map((a) => <ItemAnexo key={a.id} a={a} />)}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        {tipos.length > 1 && (
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoAnexo)} className="campo py-2.5 sm:w-64" aria-label="Tipo do documento">
            {tipos.map((t) => <option key={t} value={t}>{TIPOS_ANEXO[t].rotulo}</option>)}
          </select>
        )}
        <button type="button" disabled={enviando} onClick={() => input.current?.click()} className="botao-contorno flex-1 text-sm">
          {enviando ? "Enviando…" : `📎 Anexar ${tipos.length === 1 ? TIPOS_ANEXO[tipos[0]].rotulo : "arquivo"} (PDF ou foto)`}
        </button>
        <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => enviar(e.target.files?.[0])} />
      </div>
      {mensagem.erro && <p className="text-sm text-perigo">{mensagem.erro}</p>}
      {mensagem.sucesso && <p className="text-sm text-sucesso">{mensagem.sucesso}</p>}
    </div>
  );
}

function ItemAnexo({ a }: { a: Anexo }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(removerAnexo, {});
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
      <a href={a.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2.5 hover:underline">
        <span className="text-lg" aria-hidden="true">{a.tipo_mime === "application/pdf" ? "📕" : "🖼️"}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{TIPOS_ANEXO[a.tipo]?.rotulo ?? "Documento"}</span>
          <span className="block truncate text-xs text-suave">{a.nome} · {tamanho(a.tamanho)} · enviado em {formatarData(a.criado_em)}</span>
        </span>
      </a>
      <form
        action={acao}
        onSubmit={(e) => {
          if (!confirm("Remover este arquivo?")) e.preventDefault();
        }}
        className="shrink-0"
      >
        <input type="hidden" name="id" value={a.id} />
        <button type="submit" disabled={pendente} className="text-xs text-suave underline hover:text-perigo">{pendente ? "…" : "Remover"}</button>
        {estado.erro && <span className="block text-xs text-perigo">{estado.erro}</span>}
      </form>
    </li>
  );
}
