"use client";

import { useFormStatus } from "react-dom";

/** Botão de envio que pede confirmação antes de excluir. */
export function BotaoExcluir({ mensagem, children }: { mensagem: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(mensagem)) e.preventDefault();
      }}
      className="botao w-full border border-perigo/30 text-perigo hover:bg-perigo-claro"
    >
      {pending ? "Excluindo…" : children}
    </button>
  );
}
