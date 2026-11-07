import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function PaginaTexto({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="bg-tinta">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
          <Link href="/"><Logo claro /></Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl space-y-4 px-4 py-10 leading-relaxed text-texto sm:px-6 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-suave [&_li]:text-suave">
        <h1 className="text-3xl font-bold">{titulo}</h1>
        <p className="rounded-xl bg-alerta-claro px-4 py-3 text-sm !text-[#8a5a00]">
          Texto provisório. Antes de publicar, revise com os dados oficiais da empresa (razão social,
          CNPJ, endereço e contato) e, se possível, com um profissional jurídico.
        </p>
        {children}
      </article>
    </div>
  );
}
