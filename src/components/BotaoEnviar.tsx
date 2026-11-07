"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function BotaoEnviar({
  children,
  pendente = "Aguarde…",
  className = "botao-primario w-full",
}: {
  children: ReactNode;
  pendente?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendente : children}
    </button>
  );
}
