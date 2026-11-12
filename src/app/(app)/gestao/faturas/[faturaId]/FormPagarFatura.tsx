"use client";

import { useActionState, useState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { CampoDinheiro } from "@/components/CampoDinheiro";
import { CamposRecebimento } from "@/components/gestao/Recebimento";
import { Aviso, Campo } from "@/components/ui";
import type { Conta } from "@/lib/gestao";
import { pagarFatura } from "../actions";

export function FormPagarFatura({ faturaId, saldo, contas, hoje }: { faturaId: string; saldo: number; contas: Conta[]; hoje: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(pagarFatura, {});
  const [valor, setValor] = useState(saldo);
  return (
    <form action={acao} className="space-y-3" key={estado.sucesso}>
      <input type="hidden" name="id" value={faturaId} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      <Campo rotulo="Valor recebido (R$)" dica="Pode ser parcial">
        <CampoDinheiro name="valor" valor={valor} aoMudar={setValor} />
      </Campo>
      <CamposRecebimento contas={contas} valor={valor} hoje={hoje} rotuloValor="Valor recebido">
        {(pronto) => (
          <BotaoEnviar pendente="Registrando…" className={`botao-primario w-full ${pronto && valor > 0 ? "" : "pointer-events-none opacity-50"}`}>
            Registrar pagamento
          </BotaoEnviar>
        )}
      </CamposRecebimento>
    </form>
  );
}
