"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { entrar, type EstadoForm } from "../actions";

export function FormEntrar() {
  const params = useSearchParams();
  const [estado, acao] = useActionState<EstadoForm, FormData>(entrar, {});
  const erroLink = params.get("erro") === "link";

  return (
    <form action={acao} className="space-y-4">
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      {erroLink && <Aviso tipo="erro">O link expirou ou já foi usado. Tente novamente.</Aviso>}
      {params.get("confirmado") && <Aviso tipo="sucesso">E-mail confirmado! Agora é só entrar.</Aviso>}
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <Campo rotulo="E-mail">
        <input name="email" type="email" autoComplete="email" inputMode="email" required className="campo" placeholder="voce@email.com" />
      </Campo>
      <Campo rotulo="Senha">
        <input name="senha" type="password" autoComplete="current-password" required className="campo" placeholder="Sua senha" />
      </Campo>

      <div className="flex justify-end">
        <Link href="/recuperar-senha" className="text-sm font-medium text-marca-escura hover:underline">
          Esqueci minha senha
        </Link>
      </div>

      <BotaoEnviar pendente="Entrando…">Entrar</BotaoEnviar>

      <p className="pt-2 text-center text-sm text-suave">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-marca-escura hover:underline">
          Criar conta
        </Link>
      </p>
    </form>
  );
}
