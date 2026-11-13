"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function BotaoEnviar({
  children,
  pendente = "Aguarde…",
  className = "botao-primario w-full",
  name,
  value,
}: {
  children: ReactNode;
  pendente?: string;
  className?: string;
  /** Para formulários com mais de um botão (o servidor sabe qual foi tocado) */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} name={name} value={value}>
      {pending ? pendente : children}
    </button>
  );
}
