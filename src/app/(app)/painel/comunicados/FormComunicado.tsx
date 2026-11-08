"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { Aviso, Campo } from "@/components/ui";
import { enviarComunicado } from "./actions";
import { DESTINOS, TIPOS_COMUNICADO, type TipoComunicado } from "./tipos";

const SUGESTOES: Record<TipoComunicado, { titulo: string; mensagem: string }> = {
  novidade: { titulo: "Novo serviço na Sempre Zero", mensagem: "Agora fazemos vitrificação de faróis! Peça seu orçamento pelo app." },
  promocao: { titulo: "Semana da higienização: 20% off", mensagem: "Até sexta, higienização interna com 20% de desconto. Agende seu horário pelo app." },
  lembrete: { titulo: "Licenciamento: confira o prazo", mensagem: "Os prazos do licenciamento estão chegando. Cadastre o vencimento no app e te avisamos." },
  oportunidade: { titulo: "Horários livres esta semana", mensagem: "Temos horários de lavagem disponíveis na quinta e sexta. Garanta o seu!" },
};

export function FormComunicado({ clientes, emailDisponivel }: { clientes: number; emailDisponivel: boolean }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(enviarComunicado, {});
  const [tipo, setTipo] = useState<TipoComunicado>("novidade");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [destino, setDestino] = useState("");

  return (
    <form
      key={estado.sucesso ?? "form"}
      action={acao}
      onSubmit={(e) => {
        if (!confirm(`Enviar este comunicado para ${clientes} ${clientes === 1 ? "cliente" : "clientes"}?`)) e.preventDefault();
      }}
      className="space-y-4"
    >
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}

      <Campo rotulo="Tipo">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(TIPOS_COMUNICADO) as TipoComunicado[]).map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-xl border px-2 py-2.5 text-center text-sm transition ${
                tipo === t ? "border-marca bg-marca-clara font-semibold text-marca-escura" : "border-borda bg-white"
              }`}
            >
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
              {TIPOS_COMUNICADO[t].icone} {TIPOS_COMUNICADO[t].rotulo}
            </label>
          ))}
        </div>
      </Campo>

      <Campo rotulo="Título" dica={`${titulo.length}/80 · aparece em destaque na notificação`}>
        <input name="titulo" required maxLength={80} value={titulo} onChange={(e) => setTitulo(e.target.value)} className="campo" placeholder={SUGESTOES[tipo].titulo} />
      </Campo>
      <Campo rotulo="Mensagem" dica={`${mensagem.length}/500`}>
        <textarea name="mensagem" required maxLength={500} rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} className="campo" placeholder={SUGESTOES[tipo].mensagem} />
      </Campo>
      {!titulo && !mensagem && (
        <button
          type="button"
          onClick={() => {
            setTitulo(SUGESTOES[tipo].titulo);
            setMensagem(SUGESTOES[tipo].mensagem);
          }}
          className="-mt-2 text-sm font-semibold text-marca-escura"
        >
          Usar o exemplo
        </button>
      )}

      <Campo rotulo="Ao tocar no aviso, o cliente vai para">
        <select name="link" value={destino} onChange={(e) => setDestino(e.target.value)} className="campo">
          {DESTINOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </Campo>
      {destino === "outro" && (
        <Campo rotulo="Link">
          <input name="link_externo" type="url" required className="campo" placeholder="https://instagram.com/semprezero" />
        </Campo>
      )}

      {emailDisponivel && (
        <label className="flex items-center gap-3 text-sm">
          <input name="por_email" type="checkbox" className="h-5 w-5 accent-[var(--color-marca)]" />
          Enviar também por e-mail
        </label>
      )}

      {(titulo || mensagem) && (
        <div className="rounded-xl bg-tinta p-4 text-white">
          <p className="text-[11px] tracking-wide text-white/50 uppercase">Prévia da notificação</p>
          <p className="mt-1 font-semibold">{TIPOS_COMUNICADO[tipo].icone} {titulo || "Título"}</p>
          <p className="text-sm text-white/75">{mensagem || "Mensagem"}</p>
        </div>
      )}

      <button type="submit" disabled={pendente || clientes === 0} className="botao-primario w-full">
        {pendente ? "Enviando…" : `Enviar para ${clientes} ${clientes === 1 ? "cliente" : "clientes"}`}
      </button>
    </form>
  );
}
