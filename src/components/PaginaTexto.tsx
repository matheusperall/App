import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { DADOS_EMPRESA } from "@/lib/empresa";

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
        {children}
        <h2>Contato</h2>
        <address className="space-y-1 rounded-xl border border-borda bg-white px-4 py-3 text-sm not-italic text-suave">
          <strong className="block text-texto">{DADOS_EMPRESA.nome}</strong>
          <span className="block">CNPJ {DADOS_EMPRESA.cnpj}</span>
          <span className="block">{DADOS_EMPRESA.endereco}</span>
          <span className="block">
            Telefone/WhatsApp: <a href={`https://wa.me/55${DADOS_EMPRESA.telefone.replace(/\D/g, "")}`} className="text-marca-escura underline">{DADOS_EMPRESA.telefone}</a>
          </span>
          <span className="block">
            E-mail: <a href={`mailto:${DADOS_EMPRESA.email}`} className="text-marca-escura underline">{DADOS_EMPRESA.email}</a>
          </span>
        </address>
      </article>
    </div>
  );
}
