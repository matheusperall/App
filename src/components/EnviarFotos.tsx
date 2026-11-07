"use client";

import { useRef, useState } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

type Foto = { caminho: string; url: string };

/** Reduz a foto (celulares tiram fotos enormes) antes de enviar. */
async function comprimir(arquivo: File, ladoMax = 1600, qualidade = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((ok, erro) =>
    canvas.toBlob((b) => (b ? ok(b) : erro(new Error("falha ao comprimir"))), "image/jpeg", qualidade),
  );
}

/**
 * Envia fotos direto para o Storage do Supabase e coloca os caminhos em
 * campos ocultos chamados "fotos", que seguem junto com o formulário.
 */
export function EnviarFotos({
  pasta,
  maximo = 6,
  iniciais = [],
  rotulo = "Adicionar fotos",
}: {
  /** Começa sempre com o id do dono do veículo, ex.: "<dono>/<veiculo>" */
  pasta: string;
  maximo?: number;
  iniciais?: Foto[];
  rotulo?: string;
}) {
  const [fotos, setFotos] = useState<Foto[]>(iniciais);
  const [enviando, setEnviando] = useState(0);
  const [erro, setErro] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function selecionar(lista: FileList | null) {
    if (!lista?.length) return;
    setErro("");
    if (!isSupabaseConfigured) {
      setErro("Modo demonstração: o envio de fotos funciona depois de conectar o banco.");
      return;
    }
    const arquivos = Array.from(lista).slice(0, maximo - fotos.length);
    const supabase = createClient();
    setEnviando(arquivos.length);

    for (const arquivo of arquivos) {
      try {
        const blob = await comprimir(arquivo);
        const caminho = `${pasta}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from("fotos")
          .upload(caminho, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (error) throw error;
        setFotos((f) => [...f, { caminho, url: URL.createObjectURL(blob) }]);
      } catch {
        setErro("Não foi possível enviar uma das fotos. Tente novamente.");
      } finally {
        setEnviando((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  const cheio = fotos.length >= maximo;

  return (
    <div className="relative space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {fotos.map((f) => (
          <div key={f.caminho} className="relative aspect-square overflow-hidden rounded-xl bg-borda">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt="" className="h-full w-full object-cover" />
            <input type="hidden" name="fotos" value={f.caminho} />
            <button
              type="button"
              onClick={() => setFotos((l) => l.filter((x) => x.caminho !== f.caminho))}
              className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-tinta/80 text-white"
              aria-label="Remover foto"
            >
              ×
            </button>
          </div>
        ))}
        {Array.from({ length: enviando }).map((_, i) => (
          <div key={`env-${i}`} className="aspect-square animate-pulse rounded-xl bg-borda" />
        ))}
        {!cheio && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-borda bg-white text-suave transition hover:border-marca hover:text-marca-escura"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            <span className="px-1 text-center text-xs font-medium">{rotulo}</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={maximo > 1}
        className="hidden"
        onChange={(e) => selecionar(e.target.files)}
      />
      {enviando > 0 && (
        // Impede salvar o formulário antes de terminar o envio
        <input
          required
          tabIndex={-1}
          aria-hidden="true"
          value=""
          onChange={() => {}}
          ref={(el) => el?.setCustomValidity("Aguarde o envio das fotos terminar.")}
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      )}
      {erro && <p className="text-sm text-perigo">{erro}</p>}
      {enviando > 0 && <p className="text-sm text-suave">Enviando foto…</p>}
    </div>
  );
}
