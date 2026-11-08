"use server";

import { exigirAdmin } from "@/lib/auth";
import { processarLembretes } from "@/lib/lembretes";
import { getSiteUrl } from "@/lib/site";

/** Roda os lembretes agora (os mesmos do agendamento diário). Não repete avisos já enviados. */
export async function executarLembretesAgora() {
  await exigirAdmin();
  try {
    const r = await processarLembretes(await getSiteUrl());
    return {
      ok: true,
      mensagem:
        r.enviados === 0
          ? `Tudo verificado (${r.verificados} itens). Nenhum aviso novo para enviar hoje.`
          : `${r.enviados} ${r.enviados === 1 ? "aviso enviado" : "avisos enviados"} para ${r.clientes} ${r.clientes === 1 ? "pessoa" : "pessoas"}.`,
    };
  } catch (e) {
    return { ok: false, mensagem: `Erro: ${(e as Error).message}` };
  }
}
