"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso, Campo } from "@/components/ui";
import { cadastrar, type EstadoForm } from "../actions";

export function FormCadastro() {
  const [estado, acao] = useActionState<EstadoForm, FormData>(cadastrar, {});

  if (estado.sucesso) {
    return (
      <div className="space-y-4">
        <Aviso tipo="sucesso">{estado.sucesso}</Aviso>
        <Link href="/entrar" className="botao-contorno w-full">
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={acao} className="space-y-4" key={estado.erro ?? "inicial"}>
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}

      <Campo rotulo="Nome completo">
        <input name="nome" defaultValue={estado.valores?.nome} autoComplete="name" required className="campo" placeholder="Seu nome" />
      </Campo>
      <Campo rotulo="Celular (WhatsApp)" dica="Opcional. Usado só para falarmos sobre seus serviços.">
        <input name="telefone" defaultValue={estado.valores?.telefone} type="tel" autoComplete="tel" inputMode="tel" className="campo" placeholder="(11) 90000-0000" />
      </Campo>
      <Campo rotulo="E-mail">
        <input name="email" defaultValue={estado.valores?.email} type="email" autoComplete="email" inputMode="email" required className="campo" placeholder="voce@email.com" />
      </Campo>
      <Campo rotulo="Senha" dica="Mínimo de 8 caracteres.">
        <input name="senha" type="password" autoComplete="new-password" minLength={8} required className="campo" placeholder="Crie uma senha" />
      </Campo>

      <label className="flex items-start gap-3 text-sm text-suave">
        <input name="aceite" type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-marca)]" />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="font-medium text-marca-escura underline">termos de uso</Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="font-medium text-marca-escura underline">política de privacidade</Link>.
        </span>
      </label>

      <BotaoEnviar pendente="Criando conta…">Criar conta</BotaoEnviar>

      <p className="pt-2 text-center text-sm text-suave">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-marca-escura hover:underline">Entrar</Link>
      </p>
    </form>
  );
}
