"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { recuperarSenha, type EstadoForm } from "../actions";

export default function RecuperarSenhaPage() {
  const [estado, acao] = useActionState<EstadoForm, FormData>(recuperarSenha, {});

  return (
    <div className="space-y-6">
      <title>Recuperar senha · Sempre Zero</title>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Esqueceu a senha?</h1>
        <p className="text-suave">Informe seu e-mail e enviaremos um link para criar uma nova.</p>
      </div>
      {estado.sucesso ? (
        <Aviso tipo="sucesso">{estado.sucesso}</Aviso>
      ) : (
        <form action={acao} className="space-y-4">
          {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
          <Campo rotulo="E-mail">
            <input name="email" type="email" autoComplete="email" inputMode="email" required className="campo" placeholder="voce@email.com" />
          </Campo>
          <BotaoEnviar pendente="Enviando…">Enviar link</BotaoEnviar>
        </form>
      )}
      <p className="text-center text-sm">
        <Link href="/entrar" className="font-semibold text-marca-escura hover:underline">Voltar para o login</Link>
      </p>
    </div>
  );
}
