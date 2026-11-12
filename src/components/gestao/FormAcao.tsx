"use client";

import { useActionState, type ReactNode } from "react";
import type { EstadoForm } from "@/app/(auth)/actions";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Aviso } from "@/components/ui";

/**
 * Formulário pequeno que chama uma ação do servidor e mostra o resultado (erro ou sucesso).
 * `campos` são inputs ocultos; `children` são os campos visíveis.
 */
export function FormAcao({
  acao,
  campos = {},
  botao,
  pendente = "Salvando…",
  classeBotao = "botao-primario w-full",
  confirmar,
  children,
  className = "space-y-3",
  limparAoConcluir = false,
}: {
  acao: (estado: EstadoForm, form: FormData) => Promise<EstadoForm>;
  campos?: Record<string, string>;
  botao: ReactNode;
  pendente?: string;
  classeBotao?: string;
  confirmar?: string;
  children?: ReactNode;
  className?: string;
  limparAoConcluir?: boolean;
}) {
  const [estado, executar] = useActionState<EstadoForm, FormData>(acao, {});
  return (
    <form
      action={executar}
      className={className}
      key={limparAoConcluir ? (estado.sucesso ?? "") : undefined}
      onSubmit={(e) => {
        if (confirmar && !confirm(confirmar)) e.preventDefault();
      }}
    >
      {Object.entries(campos).map(([n, v]) => (
        <input key={n} type="hidden" name={n} value={v} />
      ))}
      {estado.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      {estado.sucesso && <Aviso tipo="sucesso">{estado.sucesso}</Aviso>}
      {children}
      <BotaoEnviar pendente={pendente} className={classeBotao}>
        {botao}
      </BotaoEnviar>
    </form>
  );
}
