"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { redefinirSenha, type EstadoForm } from "../actions";

export default function RedefinirSenhaPage() {
  const [estado, acao] = useActionState<EstadoForm, FormData>(redefinirSenha, {});

  return (
    <div className="space-y-6">
      <title>Nova senha · Sempre Zero</title>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Crie uma nova senha</h1>
        <p className="text-suave">Escolha uma senha com pelo menos 8 caracteres.</p>
      </div>
      <form action={acao} className="space-y-4">
        {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
        <Campo rotulo="Nova senha">
          <input name="senha" type="password" autoComplete="new-password" minLength={8} required className="campo" />
        </Campo>
        <Campo rotulo="Repita a nova senha">
          <input name="confirmacao" type="password" autoComplete="new-password" minLength={8} required className="campo" />
        </Campo>
        <BotaoEnviar pendente="Salvando…">Salvar nova senha</BotaoEnviar>
      </form>
    </div>
  );
}
