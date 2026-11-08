"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { confirmarAgendamento, recusarAgendamento } from "../actions";

const DURACOES = [
  ["60", "1 hora"],
  ["90", "1h30"],
  ["120", "2 horas"],
  ["240", "4 horas"],
  ["d1", "O dia todo"],
  ["d2", "2 dias"],
  ["d3", "3 dias"],
  ["d5", "5 dias"],
  ["d7", "7 dias"],
  ["d10", "10 dias"],
] as const;

export function ConfirmarAgendamento({
  id,
  tipo,
  diaInicial,
  horaInicial,
  podeRecusar,
}: {
  id: string;
  tipo: "lavagem" | "servico";
  diaInicial: string;
  horaInicial: string;
  podeRecusar: boolean;
}) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(confirmarAgendamento, {});
  const [estadoR, acaoR, pendenteR] = useActionState<EstadoForm, FormData>(recusarAgendamento, {});
  const [recusando, setRecusando] = useState(false);

  if (estadoR.sucesso) return <Aviso tipo="sucesso">{estadoR.sucesso}</Aviso>;

  if (recusando) {
    return (
      <form action={acaoR} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <textarea name="resposta" required rows={3} className="campo" placeholder="Ex.: Nessas datas não temos vaga. Podemos na próxima terça?" />
        {estadoR.erro && <Aviso tipo="erro">{estadoR.erro}</Aviso>}
        <div className="flex gap-2">
          <button type="submit" disabled={pendenteR} className="botao-escuro flex-1">{pendenteR ? "Enviando…" : "Enviar ao cliente"}</button>
          <button type="button" onClick={() => setRecusando(false)} className="botao px-4 text-suave">Voltar</button>
        </div>
      </form>
    );
  }

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Dia">
          <input name="dia" type="date" required defaultValue={diaInicial} className="campo" />
        </Campo>
        <Campo rotulo="Horário">
          <input name="hora" type="time" required step={900} defaultValue={horaInicial} className="campo" />
        </Campo>
      </div>
      <Campo rotulo="Duração" dica={tipo === "servico" ? "Serviços de vários dias terminam às 18h do último dia." : undefined}>
        <select name="duracao" defaultValue={tipo === "lavagem" ? "60" : "d1"} className="campo">
          {DURACOES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Mensagem para o cliente" dica="Opcional.">
        <input name="resposta" className="campo" placeholder="Ex.: Pode deixar o carro a partir das 8h." />
      </Campo>
      <BotaoEnviar pendente="Salvando…">Confirmar e avisar o cliente</BotaoEnviar>
      {podeRecusar && (
        <button type="button" onClick={() => setRecusando(true)} className="w-full text-center text-sm font-medium text-suave underline">
          Não dá nessas datas — responder ao cliente
        </button>
      )}
    </form>
  );
}
