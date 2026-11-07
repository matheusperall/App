"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ItemNav = { href: string; rotulo: string; icone: "garagem" | "conta" | "painel" };

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
  painel: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
};

function Icone({ nome }: { nome: ItemNav["icone"] }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      {ICONES[nome]}
    </svg>
  );
}

export function LinksNavegacao({ itens, local }: { itens: ItemNav[]; local: "topo" | "rodape" }) {
  const path = usePathname();
  const ativo = (href: string) => path === href || path.startsWith(`${href}/`);

  if (local === "topo") {
    return (
      <nav className="hidden items-center gap-1 sm:flex">
        {itens.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              ativo(i.href) ? "bg-white/10 text-white" : "text-white/70 hover:text-white"
            }`}
          >
            {i.rotulo}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <ul className="mx-auto flex max-w-md">
        {itens.map((i) => (
          <li key={i.href} className="flex-1">
            <Link
              href={i.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                ativo(i.href) ? "text-marca-escura" : "text-suave"
              }`}
            >
              <Icone nome={i.icone} />
              {i.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
