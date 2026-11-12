"use client";

import { useActionState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { CamposRecebimento } from "@/components/gestao/Recebimento";
import { Aviso } from "@/components/ui";
import type { Conta } from "@/lib/gestao";
import { receberOS } from "../actions";

export function FormReceber({ osId, total, contas, hoje }: { osId: string; total: number; contas: Conta[]; hoje: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(receberOS, {});
  if (estado.sucesso) return <Aviso tipo="sucesso">{estado.sucesso}</Aviso>;
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="id" value={osId} />
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <CamposRecebimento contas={contas} valor={total} hoje={hoje} rotuloValor="Valor da OS">
        {(pronto) => (
          <BotaoEnviar pendente="Registrando…" className={`botao-primario w-full ${pronto ? "" : "pointer-events-none opacity-50"}`}>
            Registrar pagamento
          </BotaoEnviar>
        )}
      </CamposRecebimento>
    </form>
  );
}
