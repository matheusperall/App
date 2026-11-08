"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { Aviso, Cartao } from "@/components/ui";
import type { SituacaoApontamento } from "@/lib/garagem";
import { responderApontamento } from "../../../apontamentos-actions";

const OPCOES = [
  { valor: "orcamento", rotulo: "Quero um orçamento", icone: "💬", classe: "botao-primario" },
  { valor: "agendamento", rotulo: "Quero agendar", icone: "📅", classe: "botao-escuro" },
  { valor: "recusado", rotulo: "Agora não", icone: "⏸", classe: "botao-contorno" },
] as const;

export function RespostaCliente({ id, situacao }: { id: string; situacao: SituacaoApontamento }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(responderApontamento, {});
  const [escolha, setEscolha] = useState<string>("");

  if (situacao === "agendado" || situacao === "concluido") {
    return (
      <Aviso tipo="sucesso">
        {situacao === "agendado" ? "Este serviço já está agendado com a nossa equipe." : "Este serviço foi concluído. ✓"}
      </Aviso>
    );
  }

  if (estado.sucesso) return <Aviso tipo="sucesso">{estado.sucesso}</Aviso>;

  return (
    <Cartao className="space-y-3">
      <h2 className="font-semibold">
        {situacao === "orcamento" || situacao === "agendamento" ? "Quer mudar sua resposta?" : "O que você prefere?"}
      </h2>
      {situacao === "orcamento" && <p className="text-sm text-suave">Você já pediu um orçamento. Vamos responder em breve.</p>}
      {situacao === "agendamento" && <p className="text-sm text-suave">Você já pediu um agendamento. Vamos entrar em contato.</p>}
      <form action={acao} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="resposta" value={escolha} />
        <div className="grid gap-2 sm:grid-cols-3">
          {OPCOES.map((o) => (
            <button
              key={o.valor}
              type="button"
              onClick={() => setEscolha(o.valor)}
              className={`${escolha === o.valor ? o.classe : "botao-contorno"} text-sm ${escolha && escolha !== o.valor ? "opacity-60" : ""}`}
            >
              <span aria-hidden="true">{o.icone}</span> {o.rotulo}
            </button>
          ))}
        </div>
        {escolha && (
          <>
            <textarea
              name="mensagem"
              rows={3}
              className="campo"
              placeholder={
                escolha === "agendamento"
                  ? "Opcional: sugira dias e horários (atendemos de segunda a sexta, das 8h às 18h)."
                  : escolha === "orcamento"
                    ? "Opcional: alguma dúvida ou observação?"
                    : "Opcional: quer nos contar o motivo?"
              }
            />
            <button type="submit" disabled={pendente} className="botao-primario w-full">
              {pendente ? "Enviando…" : "Enviar resposta"}
            </button>
          </>
        )}
        {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      </form>
    </Cartao>
  );
}
