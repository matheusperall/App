"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import type { EstadoForm } from "@/app/(auth)/actions";
import { atualizarPerfil } from "./actions";

export function FormPerfil({ nome, telefone, email }: { nome: string; telefone: string; email: string }) {
  const [estado, acao] = useActionState<EstadoForm, FormData>(atualizarPerfil, {});

  return (
    <form action={acao} className="space-y-4">
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      <Campo rotulo="E-mail">
        <input value={email} disabled className="campo bg-fundo text-suave" />
      </Campo>
      <Campo rotulo="Nome completo">
        <input name="nome" defaultValue={nome} required autoComplete="name" className="campo" />
      </Campo>
      <Campo rotulo="Celular (WhatsApp)">
        <input name="telefone" type="tel" defaultValue={telefone} autoComplete="tel" inputMode="tel" className="campo" />
      </Campo>
      <BotaoEnviar pendente="Salvando…" className="botao-escuro w-full">Salvar</BotaoEnviar>
    </form>
  );
}
