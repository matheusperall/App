"use client";

import { useActionState } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { cadastrarCliente } from "../actions";

export function FormCliente() {
  const [estado, acao] = useActionState<EstadoForm, FormData>(cadastrarCliente, {});
  return (
    <form action={acao} className="space-y-4">
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <Campo rotulo="Nome completo">
        <input name="nome" required className="campo" />
      </Campo>
      <Campo rotulo="E-mail">
        <input name="email" type="email" required inputMode="email" className="campo" />
      </Campo>
      <Campo rotulo="Celular (WhatsApp)">
        <input name="telefone" type="tel" inputMode="tel" className="campo" placeholder="(11) 90000-0000" />
      </Campo>
      <BotaoEnviar pendente="Cadastrando…">Cadastrar e enviar convite</BotaoEnviar>
    </form>
  );
}
