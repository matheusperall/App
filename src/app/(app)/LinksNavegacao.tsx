"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type ItemNav = { href: string; rotulo: string; icone: "garagem" | "conta" | "painel" | "avisos" | "orcamentos" | "agenda" | "gestao"; contador?: number };

const ICONES: Record<ItemNav["icone"], React.ReactNode> = {
  garagem: (
    <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-4v-6H8v6H4a1 1 0 0 1-1-1v-9.5Z" />
  ),
  conta: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  agenda: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  orcamentos: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 16h5" />
    </>
  ),
  avisos: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  gestao: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  painel: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
};

function Contador({ n, className = "" }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-perigo px-1 text-[10px] font-bold text-white ${className}`}>
      {n > 9 ? "9+" : n}
    </span>
  );
}

function Icone({ nome }: { nome: ItemNav["icone"] }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      {ICONES[nome]}
    </svg>
  );
}

export function LinksNavegacao({ itens, local }: { itens: ItemNav[]; local: "topo" | "rodape" }) {
  const path = usePathname();
  // Depois de abrir a página de avisos, o contador zera sem precisar recarregar
  const [avisosVistos, setAvisosVistos] = useState(false);
  if (path === "/notificacoes" && !avisosVistos) setAvisosVistos(true);
  const lista = itens.map((i) => (i.href === "/notificacoes" && avisosVistos ? { ...i, contador: 0 } : i));
  const ativo = (href: string) => path === href || path.startsWith(`${href}/`);

  if (local === "topo") {
    return (
      <nav className="hidden items-center gap-1 sm:flex">
        {lista.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              ativo(i.href) ? "bg-white/10 text-white" : "text-white/70 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {i.rotulo}
              <Contador n={i.contador} />
            </span>
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <ul className="mx-auto flex max-w-md">
        {lista.map((i) => (
          <li key={i.href} className="flex-1">
            <Link
              href={i.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                ativo(i.href) ? "text-marca-escura" : "text-suave"
              }`}
            >
              <span className="relative">
                <Icone nome={i.icone} />
                <Contador n={i.contador} className="absolute -top-1.5 -right-2.5" />
              </span>
              {i.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
